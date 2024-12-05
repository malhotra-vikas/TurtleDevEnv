import json
import boto3
import os
from pdfminer.high_level import extract_text
from pdfminer.pdfparser import PDFSyntaxError
from urllib.parse import urlparse

def parsePDFHandler(event, context):
    # Initialize S3 client
    s3 = boto3.client('s3')
    
    # Initialize a session using boto3
    dynamodb = boto3.resource('dynamodb')

    newLeasesTableName = os.getenv("LEASEWISELY_NEWLEASE_DYNAMODB_TABLE_NAME")
    userLeasesTableName = os.getenv("LEASEWISELY_USERLEASE_DYNAMODB_TABLE_NAME")

    try:
        # Process each SNS record in the event
        for record in event['Records']:
            sns_message = json.loads(record['Sns']['Message'])
            print('Event received:', json.dumps(event, indent=4))

            uuid = sns_message['uuid']
            user_email = sns_message['email']
            print('Event received and message details are :', uuid, user_email);

            newLeasesDDB = dynamodb.Table(newLeasesTableName)

            response = newLeasesDDB.get_item(Key={'uuid': uuid})
            
            if 'Item' in response:
                s3_file_path = response['Item'].get('s3FilePath')
                print('s3_file_path is :', s3_file_path)

                # Parse the S3 file path to extract the bucket name and file key
                bucket_name = s3_file_path.split('/')[2]
                file_key = '/'.join(s3_file_path.split('/')[3:])
                print('s3_file_path is :', bucket_name, file_key)
                
                # Construct the temporary file path in the /tmp directory
                tmp_file_path = os.path.join('/tmp', file_key)
                tmp_dir = os.path.dirname(tmp_file_path)
                
                # Ensure the directory exists
                if not os.path.exists(tmp_dir):
                    os.makedirs(tmp_dir)
                
                print('TEMP file_path is :', tmp_file_path)

            
                # Download the PDF file from S3 to the /tmp directory
                s3.download_file(bucket_name, file_key, tmp_file_path)

                # Extract text from the PDF file
                try:
                    text = extract_text(tmp_file_path)
                    
                    print(f'Extracted text: {text[:500]}')  # Print the first 500 characters
                    
                    # Update the leaseText field for the given email
                    response = userLeasesTableName.update_item(
                        Key={
                            'email': user_email
                        },
                        UpdateExpression="SET leaseText = :leaseText",
                        ExpressionAttributeValues={
                            ':leaseText': text
                        },
                        ReturnValues="UPDATED_NEW"
                    )
                    print(f"Update successful. Updated attributes: {response['Attributes']}")

                    # Prepare response with extracted text (this can be customized as needed)
                    response = {
                        'statusCode': 200,
                        'body': 'Lease text updated successfully'
                    }
                except Exception as e:
                    print(f'Error extracting text: {e}')
                    response = {
                        'statusCode': 500,
                        'body': json.dumps({
                            'error': str(e)
                        })
                    }
                finally:
                    # Cleanup the temporary file
                    if os.path.exists(tmp_file_path):
                        try:
                            os.remove(tmp_file_path)
                            print(f'Temporary file {tmp_file_path} deleted.')
                        except Exception as cleanup_error:
                            print(f'Error deleting temporary file: {cleanup_error}')
                
                # Here, you might send the response to another service or log it
                print("Response: ", response)
                '''    
                except PDFSyntaxError as e:
                    print(f'PDFSyntaxError: {e}')
                    response = {
                        'statusCode': 400,
                        'body': json.dumps({
                            'error': 'Invalid PDF file.'
                        })
                    }
                '''
    except Exception as e:
        print(f'Error processing SNS event: {e}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

    return {
        'statusCode': 200,
        'body': json.dumps('Success')
    }
