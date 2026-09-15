const { Test } = require('@nestjs/testing');
const { Global, Module } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { configureApplication } = require('../dist/src/config/app-bootstrap');
const { TransformInterceptor } = require('../dist/src/common/interceptors/transform.interceptor');
const { MailQueueService } = require('../dist/src/infra/mail/mail-queue.service');
const { MailWorkersModule } = require('../dist/src/infra/mail/mail-workers.module');
const { MessagingModule } = require('../dist/src/infra/messaging/messaging.module');
const { ThrottlerModule } = require('../dist/src/infra/throttler/throttler.module');
const { RedisModule } = require('../dist/src/infra/redis/redis.module');
const { RedisService } = require('../dist/src/infra/redis/redis.service');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

async function host() {
  class DisabledBackgroundModule {}
  Module({})(DisabledBackgroundModule);
  class UncachedRedisModule {}
  Global()(UncachedRedisModule);
  Module({providers:[{provide:RedisService,useValue:{remember:(_key,load)=>load()}}],exports:[RedisService]})(UncachedRedisModule);
  const mail = { jobs: [], fail: false, async add(_name, data) { if(this.fail) throw new Error('Injected enqueue failure'); this.jobs.push(data); return { id: String(this.jobs.length) }; } };
  let builder = Test.createTestingModule({ imports:[AppModule] });
  // Exercise production routes/guards/UoW/Prisma and bootstrap. Isolate background
  // consumers and rate limiting so verification never consumes unrelated jobs.
  for(const module of [MailWorkersModule,MessagingModule,ThrottlerModule]) builder=builder.overrideModule(module).useModule(DisabledBackgroundModule);
  builder=builder.overrideModule(RedisModule).useModule(UncachedRedisModule);
  builder=builder.overrideProvider(MailQueueService).useValue(mail);
  const testing=await builder.compile();
  const app=testing.createNestApplication({logger:false});
  configureApplication(app);
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  const rows=[];
  async function call(method,path,expected,{body,token,tenantId,label=path}={}) {
    const requestId=randomUUID();
    const quote=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
    const options=[`header = ${quote('x-request-id: '+requestId)}`];
    if(token) options.push(`header = ${quote('authorization: Bearer '+token)}`);
    if(tenantId) options.push(`header = ${quote('x-tenant-id: '+tenantId)}`);
    if(body!==undefined) options.push('header = "content-type: application/json"',`data-binary = ${quote(JSON.stringify(body))}`);
    const raw=await new Promise((resolve,reject)=>{
      const child=spawn('curl.exe',['--silent','--show-error','--include','--max-time','30','--request',method,'--url',base+'/api/v1'+path,'--config','-'],{windowsHide:true});
      let out='',err=''; child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
      child.on('error',reject);child.on('exit',code=>code===0?resolve(out):reject(new Error('curl failed: '+err)));
      child.stdin.end(options.join('\n'));
    });
    const boundary=raw.indexOf('\r\n\r\n'),headers=raw.slice(0,boundary),payload=raw.slice(boundary+4);
    const status=Number(headers.split(' ')[1]);
    assert.equal(status,expected,`${method} ${label}: ${status}; ${status>=400?payload:''}`);
    assert(headers.toLowerCase().includes('x-request-id: '+requestId));
    const result=payload?JSON.parse(payload):null;
    let envelope='empty (204)';
    if(status===204) assert.equal(payload,'');
    else if(status>=400) {
      assert.equal(result.success,false);assert.equal(typeof result.error.code,'string');assert.equal(result.meta.requestId,requestId);assert(result.meta.timestamp);
      envelope='success,error,meta';
    } else {
      assert.equal(result.success,true);assert(result.timestamp);assert.equal(typeof result.message,'string');
      if(status!==202) assert('data' in result);
      envelope=status===202?'success,message,timestamp':'success,message,data,timestamp';
      assert(!JSON.stringify(result).includes('passwordHash'));
    }
    rows.push({method,path:label,status,envelope,requestId:'echoed',errorCode:result?.error?.code??null,result:'PASS'});
    return result;
  }
  return {app,mail,rows,call};
}
module.exports={host};
