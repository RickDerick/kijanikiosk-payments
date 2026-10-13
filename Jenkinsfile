pipeline {
    agent any

    environment {
        NODE_ENV  = 'test'
        BUILD_DIR = 'dist'
        APP_NAME  = 'kijanikiosk-payments'
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    // Kept from Monday so the trigger is version-controlled with the pipeline.
    // Jenkins on Multipass is unreachable from GitHub, so it polls instead of
    // receiving webhooks. H spreads the check across the 5-minute window.
    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Build') {
            steps {
                echo "Build stage: TODO"
            }
        }
        stage('Test') {
            steps {
                echo "Test stage: TODO"
            }
        }
        stage('Archive') {
            steps {
                echo "Archive stage: TODO"
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