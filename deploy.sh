PROJECT_ID=poc-project-1738136059298
REGION=us-east1
IMAGE_NAME=products-images-scraper
TAG=latest
REPOSITORY_NAME=cloud-run-source-deploy
IMAGE_URL=$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$IMAGE_NAME:$TAG

echo "Building image for Cloud Run..."
gcloud builds submit --tag $IMAGE_URL .

echo "Deploying to Cloud Run..."
gcloud run deploy products-images-scraper --allow-unauthenticated --region $REGION --image $IMAGE_URL --env-vars-file .env.yml

echo "Done!"
