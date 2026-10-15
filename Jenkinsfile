pipeline {
    agent {
        docker{
            image:'node:22.22.0-bookworm-slim'
        }
    }

    environment {
        NODE_ENV  = 'test'
        BUILD_DIR = 'dist'
        APP_NAME  = 'kijanikiosk-payments'
        HOME      = "${env.WORKSPACE}"
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/3 * * * *')
    }

    stages {
        stage('Build') {
    steps {
        sh 'node --version && npm --version'
        echo "Installing dependencies for ${APP_NAME}..."
        sh 'npm ci'

        echo "Building application..."
        sh 'npm run build'

        echo "Verifying build output..."
        sh '''
            set -e
            test -d "${BUILD_DIR}" || { echo "ERROR: build directory not found"; exit 1; }
            echo "Build output: $(ls ${BUILD_DIR} | wc -l) files in ${BUILD_DIR}/"
        '''
    }
}
                stage('Test') {
            steps {
                echo "Running test suite for ${APP_NAME}..."
                sh '''
                    set -e
                    npm test -- --ci
                '''
            }
            post {
                always {
                    // Publish JUnit results so Jenkins tracks test history
                    // even if the tests failed
                    junit allowEmptyResults: true,
                          testResults: 'test-results/*.xml'
                }
            }
        }
        stage('Archive') {
        steps {
            echo "Archiving build artifact for ${APP_NAME} build ${BUILD_NUMBER}..."
            archiveArtifacts artifacts: "${BUILD_DIR}/**",
                            fingerprint: true,
                            onlyIfSuccessful: true
            echo "Artifact archived. Download from: ${BUILD_URL}artifact/"
        }
}
        stage('Credential Test') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-credentials',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    sh 'echo "User: ${NEXUS_USER} Pass: ${NEXUS_PASS}"'
                }
            }
        }

    }

    post {
        success {
            echo "Pipeline succeeded: ${APP_NAME} build ${BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline FAILED: ${APP_NAME} build ${BUILD_NUMBER} - check logs"
        }
        always {
            echo "Build URL: ${BUILD_URL}"
        }
    }
}