// Exercise the real production bundle and video-card dialog with fixture APIs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({locale:'en-US'});
  await context.addInitScript(()=>{window.PIPED_SHARING_API='/_piped/shares';localStorage.setItem('region','US');});
  const page=await context.newPage();let calls=0, fail=false;
  await page.route('**/_piped/shares',async route=>{
   calls++;
   assert.equal(route.request().method(),'POST');
   assert.deepEqual(route.request().postDataJSON(),{videoId:'abcdefghijk'});
   await new Promise(resolve=>setTimeout(resolve,150));
   await route.fulfill({status:fail?502:201,contentType:'application/json',body:JSON.stringify({url:'https://share.example.com/s/fixture-token'})});
  });
  await page.route('**/trending?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{url:'/watch?v=abcdefghijk',title:'Fixture video',uploaderName:'Fixture author',uploaderUrl:'/channel/fixture',duration:60,views:10,uploadedDate:'Today',type:'stream',thumbnail:'',uploaderAvatar:''}])}));
  await page.route('**/config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({countries:['US'],imageProxyUrl:'https://media.example.com',registrationDisabled:true})}));
  await page.goto('http://localhost:4173/');
  await page.locator('button[title="Share"]').first().click({timeout:30000});
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('link').filter({hasText:'https://share.example.com/s/fixture-token'}).waitFor();
  assert.equal(calls,1);
  assert.equal(await dialog.getByRole('button',{name:'Copy link',exact:true}).isEnabled(),true);
  assert.equal(await dialog.locator('a[href*="/watch?"]').count(),0);
  const time=dialog.locator('#withTimeCode');
  if(await time.getAttribute('aria-checked')!=='true')await time.click();
  const input=dialog.locator('input[type="text"]');
  await input.fill('1:00:05');await input.blur();
  assert.ok((await dialog.getByRole('link').getAttribute('href')).endsWith('?t=3605'));
  await dialog.getByRole('button',{name:/Generate QR Code/i,exact:false}).click();
  await dialog.locator('canvas,img').waitFor();
  await page.keyboard.press('Escape');
  fail=true;
  await page.locator('button[title="Share"]').first().click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Copy link',exact:true}).isDisabled(),true);
  assert.equal(await dialog.getByRole('link').count(),0);
  fail=false;
  await dialog.getByRole('button',{name:'Retry',exact:true}).click();
  await dialog.getByRole('link').waitFor();
  console.log('Video-card sharing, timecodes, QR, failure and retry passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
