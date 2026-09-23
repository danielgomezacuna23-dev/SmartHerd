import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:'/Applications/Chrome.app/Contents/MacOS/Google Chrome', headless:true});
try {
 const page = await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8765/status',route=>route.fulfill({
  status:200,contentType:'application/json',headers:{'access-control-allow-origin':'http://127.0.0.1:5173'},
  body:JSON.stringify({device_id:'SH-COLLAR-001',receiver_connected:true,transmitter_connected:true,
   receiver_radio_ready:true,transmitter_radio_ready:true,last_tx_at:new Date().toISOString(),received_at:new Date().toISOString(),signal:'no_fix'})
 }));
 await page.goto('http://127.0.0.1:5173');
  await page.getByRole("button", { name: "Explorar demostración", exact: true }).click();
 await page.getByRole('button',{name:'Satélite',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.map-satellite img.leaflet-tile')].some(i=>i.complete&&i.naturalWidth>0),{},{timeout:20000});
 // With a verified physical receiver, demonstration markers are hidden.
 await page.getByRole('button',{name:/^Collar físico: Sin señal GPS/}).waitFor();
 assert.equal(await page.locator('.cow-marker').count(),0);
 assert(await page.locator('.leaflet-overlay-pane path').count()>0);
 await page.getByRole('navigation').getByRole('button',{name:'Mapa'}).click();
 assert.equal(await page.getByRole('button',{name:'Satélite',exact:true}).getAttribute('aria-pressed'),'true');
 await page.reload();
 assert.equal(await page.getByRole('button',{name:'Satélite',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Abrir preferencias'}).click();
 await page.getByRole('button',{name:'Modo oscuro'}).click();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.map-satellite .leaflet-tile-pane').evaluate(el=>getComputedStyle(el).filter),'none');
 await page.screenshot({path:'test-results/satellite-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/satellite-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.motion-content').evaluate(el=>getComputedStyle(el).animationName),'none');
 for (let i=0;i<4;i++) {
 await page.getByRole('navigation').getByRole('button',{name:'Mi ganado'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Mapa'}).click();
 }
 await page.locator('.map-view-options').getByRole('button',{name:'Mapa',exact:true}).click();
 assert(await page.locator('.map-street').count());
 for (const width of [1280, 390]) {
  await page.setViewportSize({width,height:900});
  for (const section of ['Resumen','Mapa']) {
   await page.getByRole('navigation').getByRole('button',{name:section,exact:true}).click();
   const original = await page.locator('.map').boundingBox();
   for (const mode of ['Satélite','Mapa','Satélite','Mapa']) {
    await page.locator('.map-view-options').getByRole('button',{name:mode,exact:true}).click();
    const geometry = await page.locator('.map').boundingBox();
    assert.equal(geometry.width,original.width);
    assert.equal(geometry.height,original.height);
    assert(await page.locator('.map').evaluate(el=>el.classList.contains('leaflet-container')));
    assert.equal(await page.locator('.map').evaluate(el=>getComputedStyle(el).overflow),'hidden');
    for (const label of ['Mapa','Satélite']) {
     const button = page.locator('.map-view-options').getByRole('button',{name:label,exact:true});
     await button.scrollIntoViewIfNeeded();
     assert(await button.evaluate(el=>{
      const b=el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));
     }), `${label} must not be covered`);
    }
   }
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: imágenes reales cargadas, posiciones ficticias ocultas, cerca, persistencia, móvil, movimiento reducido y navegación rápida');
} finally { await browser.close(); }
