pipeline {
    agent any

    stages {
        stage('Environment Check') {
            steps {
                sh 'echo "Build triggered for: $(git log -1 --pretty=%s)"'
                sh 'node --version'
                sh 'npm --version'
            }
        }
    }

    post {
        always {
            echo "The pipeline finished. Status: ${currentBuild.result ?: 'SUCCESS'}"
        }
    }
}
