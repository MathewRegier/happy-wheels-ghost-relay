'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
function safeKey(key){if(typeof key!=='string'||!/^blobs\/[a-f0-9]{64}\.(xml|png)$/.test(key))throw Error('Invalid storage key');return key;}
class LocalStorage {
  constructor(directory){this.directory=directory;}
  async put(key,body){const dest=path.join(this.directory,safeKey(key));await fs.mkdir(path.dirname(dest),{recursive:true});const temp=dest+'.'+require('node:crypto').randomBytes(6).toString('hex')+'.tmp';await fs.writeFile(temp,body);await fs.rename(temp,dest);}
  async get(key){return fs.readFile(path.join(this.directory,safeKey(key)));}
}
class B2Storage {
  constructor(env=process.env){
    const {S3Client}=require('@aws-sdk/client-s3');
    const endpoint=new URL(env.B2_ENDPOINT||'');
    if(endpoint.protocol!=='https:'||!/^s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.pathname!=='/')throw Error('B2_ENDPOINT must be your Backblaze S3 HTTPS endpoint.');
    if(!env.B2_BUCKET||!env.B2_KEY_ID||!env.B2_APPLICATION_KEY)throw Error('Set B2_BUCKET, B2_KEY_ID and B2_APPLICATION_KEY.');
    this.bucket=env.B2_BUCKET;
    this.client=new S3Client({endpoint:endpoint.href,region:env.B2_REGION||endpoint.hostname.split('.')[1],forcePathStyle:true,maxAttempts:3,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',credentials:{accessKeyId:env.B2_KEY_ID,secretAccessKey:env.B2_APPLICATION_KEY}});
  }
  async put(key,body){const {PutObjectCommand}=require('@aws-sdk/client-s3');await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:safeKey(key),Body:body,ContentType:key.endsWith('.xml')?'application/xml; charset=utf-8':'image/png'}),{abortSignal:AbortSignal.timeout(45000)});}
  async get(key){const {GetObjectCommand}=require('@aws-sdk/client-s3');const result=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:safeKey(key)}),{abortSignal:AbortSignal.timeout(20000)});if(result.ContentLength>16*1024*1024)throw Error('Stored map exceeds size limit');return Buffer.from(await result.Body.transformToByteArray());}
}
module.exports={B2Storage,LocalStorage};
