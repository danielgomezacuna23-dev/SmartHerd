import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('heading',{name:'Iniciar sesión',exact:true}).waitFor();
 await page.getByLabel('Contraseña',{exact:true}).fill('prueba-segura');
 await page.getByRole('button',{name:'Mostrar contraseña'}).click();
 assert.equal(await page.locator('[name=password]').getAttribute('type'),'text');
 await page.getByRole('button',{name:'Ocultar contraseña'}).click();
 for(const mode of ['claro','oscuro']) {
  await page.getByRole('button',{name:`Modo ${mode}`}).click();
  await page.screenshot({path:`test-results/login-${mode}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'¿Necesitas ayuda para ingresar?'}).click();
 await page.getByText('CONFIG-01',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await page.getByRole('heading',{name:'Resumen',exact:true}).waitFor();
 const saved=await page.evaluate(()=>localStorage.getItem('smartherd-demo-v1'));
 await page.getByRole('button',{name:'Abrir preferencias'}).click();
 await page.getByRole('button',{name:'Ayuda y diagnóstico'}).click();
 await page.getByText('No hay un error registrado en este momento.').waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Abrir preferencias'}).click();
 await page.getByRole('button',{name:'Volver al acceso',exact:true}).click();
 await page.getByRole('heading',{name:'Iniciar sesión',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('smartherd-demo-v1')),saved);
 await page.evaluate(()=>localStorage.setItem('smartherd-demo-v1','{invalid'));
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await page.getByText('LOCAL-01',{exact:true}).waitFor();
 await page.screenshot({path:'test-results/error-local.png',fullPage:true});
 await page.evaluate(value=>localStorage.setItem('smartherd-demo-v1',value),saved);
 await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await page.getByRole('heading',{name:'Resumen',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: acceso, contraseña visible, temas, móvil, demo, salida sin borrar datos, diagnóstico y recuperación');
} finally {await browser.close();}
