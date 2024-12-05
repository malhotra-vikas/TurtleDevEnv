REGION=eu-east-1
VER=20231228
RUNTIME=python3.11

mkdir -p build/pdfminer/python

docker run -v $(pwd):/out -it public.ecr.aws/lambda/python:3.11 \
    pip install pdfminer.six==$VER -t /out/build/pdfminer/python

pushd build/pdfminer
rm -rf python/Crypto/SelfTest/
zip -r ../../pdfminer.zip python/
popd

aws lambda publish-layer-version \
    --layer-name PdfMiner \
    --region $REGION \
    --description $VER \
    --zip-file fileb://pdfminer.zip \
    --compatible-runtimes $RUNTIME

#rm -rf build *.zip