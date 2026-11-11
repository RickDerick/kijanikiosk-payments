// KijaniKiosk payments: CI + container delivery pipeline (capstone, Track A)
//
//  CI (controller, pinned Node container):  Lint -> Build -> Verify -> Archive -> Publish
//  Delivery (k8s-deployer agent):           Build Image -> Push Image -> Deploy Staging
//                                           -> Smoke Test Staging -> Error-Rate Check
//  Gate:                                    Approve Production (human, after smoke passes)
//  Production (k8s-deployer agent):         Deploy Production -> Smoke Test Production
//
// A failed staging rollout or smoke test rolls staging back automatically and
// stops the build: production is never offered an unverified version.

pipeline {
    agent none

    environment {
        APP_NAME       = 'kijanikiosk-payments'
        // Nexus runs on the Multipass host, reachable from the VM and its containers.
        NEXUS_REGISTRY = 'http://10.4.110.1:8081/repository/npm-kijanikiosk/'
        IMAGE_REPO     = 'docker.io/derickharon/kk-payments'
    }

    options {
        // Includes up to 30 minutes waiting at the production approval gate
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15'))
        // One release at a time: two builds deploying to the same namespace would race
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/3 * * * *')   // Jenkins is not reachable from GitHub, so it polls main
    }

    stages {
        stage('CI') {
            agent {
                docker {
                    image 'node:22.22.0-bookworm-slim'   // pinned: never 'latest'
                }
            }
            environment {
                NODE_ENV  = 'test'
                BUILD_DIR = 'dist'
                HOME      = "${env.WORKSPACE}"   // npm needs a writable HOME in the container
            }
            stages {
                stage('Lint') {
                    steps {
                        sh 'node --version && npm --version'
                        sh 'npm ci'
                        sh 'npm run lint'
                    }
                }

                stage('Build') {
                    steps {
                        sh 'npm run build'
                        // <semver>-<git-sha>: the same version names the npm package and the image
                        script {
                            def pkgVersion = sh(script: "node -p \"require('./package.json').version\"",
                                                returnStdout: true).trim()
                            def gitShort   = sh(script: 'echo "$GIT_COMMIT" | cut -c1-7',
                                                returnStdout: true).trim()
                            env.ARTIFACT_VERSION = "${pkgVersion}-${gitShort}"
                            env.GIT_SHORT        = gitShort
                            currentBuild.displayName = "#${BUILD_NUMBER} ${env.ARTIFACT_VERSION}"
                        }
                        sh '''
                            set -e
                            test -d "${BUILD_DIR}" || { echo "ERROR: build directory not found"; exit 1; }
                            cd "${BUILD_DIR}"
                            npm version "${ARTIFACT_VERSION}" --no-git-tag-version
                        '''
                    }
                }

                stage('Verify') {
                    parallel {
                        stage('Test') {
                            steps {
                                sh 'npm test -- --ci'
                            }
                        }
                        stage('Security Audit') {
                            steps {
                                sh 'npm audit --audit-level=high'
                            }
                        }
                    }
                }

                stage('Archive') {
                    steps {
                        archiveArtifacts artifacts: "${BUILD_DIR}/**", fingerprint: true, onlyIfSuccessful: true
                    }
                }

                stage('Publish') {
                    steps {
                        withCredentials([usernamePassword(
                            credentialsId: 'nexus-credentials',
                            usernameVariable: 'NEXUS_USER',
                            passwordVariable: 'NEXUS_PASS'
                        )]) {
                            sh '''
                                set +x   # tracing would print the base64 token
                                set -e
                                cd "${BUILD_DIR}"
                                trap 'rm -f .npmrc' EXIT
                                NEXUS_AUTH=$(printf '%s' "${NEXUS_USER}:${NEXUS_PASS}" | base64 -w0)
                                printf 'registry=%s\n%s:_auth=%s\n' \
                                    "${NEXUS_REGISTRY}" "${NEXUS_REGISTRY#http:}" "${NEXUS_AUTH}" > .npmrc
                                npm publish --tag ci
                            '''
                        }
                    }
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'test-results/*.xml'
                    cleanWs()
                }
            }
        }

        stage('Deliver to Staging') {
            agent { label 'k8s-deployer' }
            environment {
                IMAGE = "${env.IMAGE_REPO}:${env.ARTIFACT_VERSION}"
                // Isolated Docker login for this build; never touches the agent user's own login
                DOCKER_CONFIG = "${env.WORKSPACE}/.docker"
            }
            stages {
                stage('Build Image') {
                    steps {
                        sh '''
                            set -e
                            docker build -f Dockerfile.production \
                              --build-arg APP_VERSION="${ARTIFACT_VERSION}" \
                              --build-arg GIT_COMMIT="${GIT_SHORT}" \
                              -t "${IMAGE}" .
                            docker run --rm "${IMAGE}" whoami | grep -qx kijani
                            echo "Image ${IMAGE} built; runs as kijani"
                        '''
                    }
                }

                stage('Push Image') {
                    steps {
                        withCredentials([usernamePassword(
                            credentialsId: 'dockerhub-credentials',
                            usernameVariable: 'DH_USER',
                            passwordVariable: 'DH_TOKEN'
                        )]) {
                            sh '''
                                set +x
                                set -e
                                mkdir -p "${DOCKER_CONFIG}"
                                printf '%s' "${DH_TOKEN}" | docker login -u "${DH_USER}" --password-stdin >/dev/null
                                # Tags are immutable: a tag that already exists is never overwritten
                                if docker manifest inspect "${IMAGE}" >/dev/null 2>&1; then
                                    echo "Tag ${IMAGE} already exists in the registry; not overwriting it"
                                else
                                    docker push "${IMAGE}"
                                fi
                            '''
                        }
                    }
                }

                stage('Deploy Staging') {
                    steps {
                        script { env.STAGING_DEPLOYED = 'true' }
                        sh 'bash scripts/deploy.sh staging "${IMAGE}" "Jenkins #${BUILD_NUMBER}: ${ARTIFACT_VERSION} to staging"'
                    }
                }

                stage('Smoke Test Staging') {
                    steps {
                        sh '''#!/bin/bash
                            set -eo pipefail   # tee must not hide a failed smoke test
                            bash scripts/smoke-test.sh staging "${ARTIFACT_VERSION}" | tee smoke-staging.txt
                        '''
                        script {
                            env.STAGING_SMOKE = sh(script: 'tail -1 smoke-staging.txt', returnStdout: true).trim()
                        }
                    }
                }

                stage('Error-Rate Check') {
                    steps {
                        sh 'bash scripts/monitor-error-rate.sh staging 10m'
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'smoke-staging.txt, monitoring/reports/*.json', allowEmptyArchive: true
                    sh 'docker logout >/dev/null 2>&1 || true'
                }
                failure {
                    script {
                        if (env.STAGING_DEPLOYED == 'true') {
                            echo 'Staging release failed: rolling staging back automatically'
                            sh 'bash scripts/rollback.sh staging || true'
                        }
                    }
                }
                cleanup {
                    cleanWs()
                }
            }
        }

        stage('Approve Production') {
            // No agent: waiting for a human must not hold an executor
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: "Staging verified: ${env.STAGING_SMOKE}\n\nDeploy ${env.ARTIFACT_VERSION} to production (default namespace)?",
                          ok: 'Deploy to production'
                }
            }
        }

        stage('Deliver to Production') {
            agent { label 'k8s-deployer' }
            environment {
                IMAGE = "${env.IMAGE_REPO}:${env.ARTIFACT_VERSION}"
            }
            stages {
                stage('Deploy Production') {
                    steps {
                        script { env.PROD_DEPLOYED = 'true' }
                        sh 'bash scripts/deploy.sh production "${IMAGE}" "Jenkins #${BUILD_NUMBER}: ${ARTIFACT_VERSION} to production"'
                    }
                }
                stage('Smoke Test Production') {
                    steps {
                        sh '''#!/bin/bash
                            set -eo pipefail
                            bash scripts/smoke-test.sh production "${ARTIFACT_VERSION}" | tee smoke-production.txt
                        '''
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'smoke-production.txt', allowEmptyArchive: true
                }
                failure {
                    script {
                        if (env.PROD_DEPLOYED == 'true') {
                            echo 'Production release failed: rolling production back automatically'
                            sh 'bash scripts/rollback.sh production || true'
                        }
                    }
                }
                cleanup {
                    cleanWs()
                }
            }
        }
    }

    post {
        success {
            echo "RELEASED: ${APP_NAME} ${env.ARTIFACT_VERSION} is live in staging and production (build ${BUILD_NUMBER})"
        }
        failure {
            echo "NOTIFY: ${APP_NAME} build ${BUILD_NUMBER} FAILED - fixing it is the team's top priority. Log: ${BUILD_URL}console"
        }
        aborted {
            echo "Build ${BUILD_NUMBER} stopped: production approval was declined or timed out. Staging keeps ${env.ARTIFACT_VERSION}."
        }
        changed {
            echo "NOTIFY: ${APP_NAME} build status changed to ${currentBuild.currentResult} in build ${BUILD_NUMBER}"
        }
    }
}
