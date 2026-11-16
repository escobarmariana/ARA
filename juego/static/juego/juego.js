const c = document.getElementById("c"), ctx = c.getContext("2d");
const menu = document.getElementById("menu");
const $ = id => document.getElementById(id);
const ANCHO_NIVEL = 6400, SUELO = 440;   // el suelo está en y=440 (el canvas mide 800x500)
const TITULO = "ARA ADVENTURE GO";
const TEXTO_INICIO = "Flechas o A/D para moverte, Espacio o ↑ para volar y saltar (doble salto). Pisa a los enemigos para derrotarlos, recoge los productos, activa los puntos de control y llega a la bandera.";
const VIDAS_MAX = 3, PARALLAX = 0.5;
let reloj = 0; // cuenta los frames, sirve para animar
ctx.imageSmoothingEnabled = false; // mantiene nítido el pixel art

/* ============================================================
   DISEÑO: todo lo visual está aquí.
   - Colores: edita DISENO.   - Imágenes: SPRITES.x.img = cargarImagen("archivo.png")
   - Animaciones: en anim, f = frames, fps = velocidad, fila = fila de la hoja.
   ============================================================ */
const DISENO = {
  fondo: cargarImagen("fondo.png"), // 1600x500, se repite cada 800 px
  abismo: "#1a1210",
  suelo: "#846248", sueloTope: "#841c16",
  estante: "#c58b4a", estanteTope: "#e8b878", estanteBorde: "#7a4f24",
  caja: "#b5803f", cajaLinea: "#7a4f24"
};
function cargarImagen(src) { const i = new Image(); i.src = (window.STATIC_URL || "") + src; return i; }

const SPRITES = {
  jugador: { img: cargarImagen("pajaro.png"), fw: 160, fh: 128, color: "#e63946", ojo: true,
    anim: { quieto:{fila:0,f:[1],fps:1}, correr:{fila:0,f:[0,1,2,3],fps:10}, saltar:{fila:0,f:[0,1,2,3],fps:14} } },
  // Enemigos: cada uno usa uno al azar. w/h = tamaño en el juego. fijo = no se voltea.
  elefante: { img: cargarImagen("enemigo_elefante.png"), fw: 115, fh: 160, w: 38, h: 52, color: "#9ca3af", ojo: true,
    anim: { caminar:{fila:0,f:[0],fps:1}, aplastado:{fila:0,f:[0],fps:1} } },
  carulla: { img: cargarImagen("enemigo_carulla.png"), fw: 160, fh: 84, w: 56, h: 30, color: "#84cc16", fijo: true,
    anim: { caminar:{fila:0,f:[0],fps:1}, aplastado:{fila:0,f:[0],fps:1} } },
  // Productos: hoja de 3 imágenes (64x64 cada una). Cada producto usa una al azar.
  producto: { img: cargarImagen("productos.png"), fw: 64, fh: 64, color: "#facc15",
    anim: { p0:{fila:0,f:[0],fps:1}, p1:{fila:0,f:[1],fps:1}, p2:{fila:0,f:[2],fps:1} } },
  exito: { img: cargarImagen("enemigo_exito.png"), fw: 160, fh: 130, w: 52, h: 42, color: "#facc15", fijo: true,
    anim: { caminar:{fila:0,f:[0],fps:1}, aplastado:{fila:0,f:[0],fps:1} } },
  d1: { img: cargarImagen("enemigo_d1.png"), fw: 138, fh: 160, w: 40, h: 46, color: "#dc2626", fijo: true,
    anim: { caminar:{fila:0,f:[0],fps:1}, aplastado:{fila:0,f:[0],fps:1} } },
  isimo: { img: cargarImagen("enemigo_isimo.png"), fw: 160, fh: 77, w: 64, h: 31, color: "#6b21a8", fijo: true,
    anim: { caminar:{fila:0,f:[0],fps:1}, aplastado:{fila:0,f:[0],fps:1} } },
  bandera: { img: null, fw: 40, fh: 140, color: "#ef4444", anim: { ondear:{fila:0,f:[0],fps:1} } }
};
const TIPOS_ENEMIGO = ["elefante", "carulla", "exito", "d1", "isimo"]; // cada enemigo elige uno al azar
const CORAZONES = { img: cargarImagen("corazones.png"), fw: 44, fh: 44 }; // lleno | vacío

function dibujarSprite(s, x, y, w, h, nombre, t, volteado) {
  const a = s.anim[nombre] || Object.values(s.anim)[0];
  const frame = a.f[Math.floor(t * a.fps / 60) % a.f.length];
  if (s.img && s.img.complete && s.img.naturalWidth) {
    ctx.save();
    if (volteado && !s.fijo) { ctx.translate(x + w, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
    ctx.drawImage(s.img, frame * s.fw, a.fila * s.fh, s.fw, s.fh, 0, 0, w, h);
    ctx.restore();
    return;
  }
  ctx.fillStyle = s.color; ctx.fillRect(x, y, w, h);
  if (s.ojo) { ctx.fillStyle = "#fff"; ctx.fillRect(volteado ? x + 4 : x + w - 10, y + 6, 6, 6); }
}

function dibujarVidas() {
  const img = CORAZONES.img, tam = 30;
  if (!(img.complete && img.naturalWidth)) return;
  for (let i = 0; i < VIDAS_MAX; i++)
    ctx.drawImage(img, i < vidas ? 0 : CORAZONES.fw, 0, CORAZONES.fw, CORAZONES.fh, 10 + i * (tam + 4), 10, tam, tam);
}

/* ============================================================
   NIVEL (6400 px de largo). Cada pieza se agrega con una función:
   suelo(x, ancho)            piso (los huecos entre pisos son abismos)
   estante(x, y, ancho)       plataforma flotante
   caja(x, ancho, alto)       caja apoyada en el piso
   movil(x, y, ancho, rango, velocidad)  plataforma que va y viene
   ============================================================ */
const plataformas = [];
const suelo = (x, w) => plataformas.push({x, y:SUELO, w, h:60, t:"suelo"});
const estante = (x, y, w) => plataformas.push({x, y, w, h:16, t:"estante"});
const caja = (x, w, h) => plataformas.push({x, y:SUELO - h, w, h, t:"caja"});
const movil = (x, y, w, rango, v) => plataformas.push({x, y, w, h:16, t:"estante", x0:x, rango, v, dir:1, dx:0});

// Zona A: inicio y estantes
suelo(0, 1000); estante(300,350,120); estante(520,290,120); estante(760,350,110);
// Zona B: pirámide de cajas y estantes altos
suelo(1130, 770);
caja(1300,40,40); caja(1340,40,80); caja(1380,40,120); caja(1420,40,80); caja(1460,40,40);
estante(1600,330,150); estante(1800,260,120);
// Zona C: islas y plataforma móvil sobre el abismo
suelo(2040,160); suelo(2340,160); movil(2530,400,90,100,1.2);
// Zona D: pasillo con ruta alta y ruta baja
suelo(2720,780); estante(2800,340,140); estante(2980,260,140); estante(3160,180,340);
// Zona E: salto de estantes sobre un abismo grande
estante(3550,380,60); estante(3660,320,60); estante(3770,380,60);
// Zona F: muro de cajas
suelo(3890,700); estante(4040,350,90); caja(4150,60,120);
// Zona G: abismo largo con plataformas móviles
movil(4620,400,90,100,1.2); estante(4880,350,80); movil(5000,330,90,100,1.4);
// Zona H: tramo final con cajas y bandera
suelo(5250,1150);
caja(5400,40,40); caja(5440,40,80); caja(5480,40,120); caja(5520,40,80); caja(5560,40,40);
estante(5700,340,120);

// Puntos de control: al caerte o perder una vida reapareces en el último que tocaste
const puntosControl = [2740, 3440, 3910, 5270].map(x => ({x, ok:false}));
// Productos [x, y] (cada uno toma una imagen al azar de la hoja)
const POSICIONES_PRODUCTOS = [
  [360,320],[580,260],[800,320],
  [1320,370],[1360,330],[1400,290],
  [1650,300],[1850,230],[2420,410],[2640,360],
  [2860,310],[3040,230],[3100,410],[3200,150],[3400,150],
  [3580,350],[3690,290],[3800,350],
  [4090,320],[4180,280],[4400,410],[4500,410],
  [4660,360],[4920,320],[5040,290],
  [5460,330],[5500,290],[5760,310],[5900,410],[6250,410]
];
// Enemigos [izquierda, derecha, y de la superficie por donde patrullan]
const PATRULLAS = [
  [300,420,350],[520,640,290],[560,950,440],[1460,1880,440],[1600,1750,330],[2050,2190,440],[2350,2490,440],
  [2810,2930,340],[2990,3110,260],[2800,3300,440],[3170,3490,180],
  [4020,4140,440],[4230,4570,440],[5620,5960,440],[6000,6280,440],[5700,5820,340]
];

let productos, enemigos, jugador, estado = "menu", vidas = VIDAS_MAX, puntos = 0, camara, teclas = {}, reaparicion;

function nuevoNivel() {
  productos = POSICIONES_PRODUCTOS.map(([x,y]) => ({x, y, tipo:Math.floor(Math.random()*3), tomado:false}));
  enemigos = PATRULLAS.map(([a,b,base]) => {
    const tipo = TIPOS_ENEMIGO[Math.floor(Math.random() * TIPOS_ENEMIGO.length)];
    const s = SPRITES[tipo];
    return {tipo, x:a, y:base - s.h, w:s.w, h:s.h, dir:1, v:1.5 + Math.random() * 0.8, a, b, vivo:true};
  });
  puntosControl.forEach(p => p.ok = false);
  reaparicion = {x:50};
  jugador = {x:50, y:300, w:34, h:28, vx:0, vy:0, suelo:false, inmune:0, dir:1, saltosUsados:0, saltoPrevio:false};
  camara = 0;
}

/* ============================================================
   MENÚS Y ESTADOS: menu, jugando, pausa, fin
   ============================================================ */
function empezar() { Musica.iniciar(); vidas = VIDAS_MAX; puntos = 0; nuevoNivel(); actualizarHUD(); estado = "jugando"; menu.classList.add("oculto"); }
function actualizarHUD() { $("productos").textContent = puntos + " / " + productos.length; }
function mostrarMenu(titulo, texto, jugar, reanudar, principal) {
  $("titulo").textContent = titulo; $("texto").textContent = texto;
  $("btnJugar").classList.toggle("oculto", !jugar);
  $("btnReanudar").classList.toggle("oculto", !reanudar);
  $("btnMenu").classList.toggle("oculto", !principal);
  $("extras").classList.toggle("oculto", !jugar);
  menu.classList.remove("oculto");
}
function pausar() {
  if (estado === "jugando") { estado = "pausa"; Musica.pausar(); mostrarMenu("Pausa", "El juego está detenido.", false, true, true); }
  else if (estado === "pausa") reanudar();
}
function reanudar() { Musica.reanudar(); estado = "jugando"; menu.classList.add("oculto"); }
$("btnJugar").onclick = empezar;
$("btnReanudar").onclick = reanudar;
$("btnMenu").onclick = () => { estado = "menu"; Musica.detener(); mostrarMenu(TITULO, TEXTO_INICIO, true, false, false); };

addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return; // escribiendo el nombre
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
  if (e.key === "p" || e.key === "P" || e.key === "Escape") pausar();
  if (e.key === "m" || e.key === "M") { Musica.alternar(); $("musicaEstado").textContent = Musica.activa ? "sí" : "no"; }
  teclas[e.key.toLowerCase()] = true;
});
addEventListener("keyup", e => teclas[e.key.toLowerCase()] = false);

/* ============================================================
   LÓGICA DEL JUEGO
   ============================================================ */
function choca(a, b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

function perderVida() {
  vidas--; Musica.sfx("golpe");
  if (vidas <= 0) { estado = "fin"; Musica.detener(); Musica.sfx("perder"); mostrarMenu("Game Over", "Productos: " + puntos + " de " + productos.length, true, false, true); guardarPuntuacion(false); return; }
  jugador.x = reaparicion.x; jugador.y = SUELO - 120; jugador.vx = jugador.vy = 0; jugador.inmune = 90; jugador.saltosUsados = 0;
}

function actualizar() {
  const j = jugador;
  reloj++;
  // Plataformas móviles: se mueven y llevan al jugador si está encima
  for (const m of plataformas) if (m.rango) {
    const encima = j.suelo && Math.abs(j.y + j.h - m.y) < 1 && j.x + j.w > m.x && j.x < m.x + m.w;
    m.dx = m.dir * m.v; m.x += m.dx;
    if (m.x > m.x0 + m.rango || m.x < m.x0) m.dir *= -1;
    if (encima) j.x += m.dx;
  }
  const izq = teclas["arrowleft"] || teclas["a"], der = teclas["arrowright"] || teclas["d"];
  const salto = teclas["arrowup"] || teclas["w"] || teclas[" "];
  j.vx = izq ? -4 : der ? 4 : 0;
  if (j.vx !== 0) j.dir = Math.sign(j.vx);
  // Doble salto: solo cuenta al pulsar la tecla, no al mantenerla
  if (salto && !j.saltoPrevio && j.saltosUsados < 2) { Musica.sfx(j.saltosUsados === 0 ? "salto" : "salto2"); j.vy = -12.5; j.suelo = false; j.saltosUsados++; }
  j.saltoPrevio = salto;
  j.vy += 0.6; // gravedad
  if (j.inmune > 0) j.inmune--;

  j.x += j.vx;
  for (const r of plataformas) if (choca(j, r)) j.x = j.vx > 0 ? r.x - j.w : r.x + r.w;
  j.x = Math.max(0, Math.min(ANCHO_NIVEL - j.w, j.x));
  j.y += j.vy; j.suelo = false;
  for (const r of plataformas) if (choca(j, r)) {
    if (j.vy > 0) { j.y = r.y - j.h; j.suelo = true; j.saltosUsados = 0; } else j.y = r.y + r.h;
    j.vy = 0;
  }
  if (j.y > 560) perderVida();

  for (const p of puntosControl) if (!p.ok && j.x > p.x) { p.ok = true; reaparicion = {x:p.x}; }

  for (const e of enemigos) {
    if (!e.vivo) continue;
    e.x += e.dir * e.v; // cada enemigo tiene su propia velocidad
    if (e.x < e.a || e.x + e.w > e.b) e.dir *= -1;
    if (choca(j, e) && estado === "jugando") {
      if (j.vy > 0 && j.y + j.h - j.vy <= e.y + 10) { e.vivo = false; e.t = 20; Musica.sfx("pisar"); j.vy = -9; j.saltosUsados = 1; } // pisotón
      else if (j.inmune === 0) perderVida();
    }
  }
  for (const m of productos) if (!m.tomado && choca(j, {x:m.x-14, y:m.y-14, w:28, h:28})) { m.tomado = true; puntos++; Musica.sfx("producto"); actualizarHUD(); }
  if (j.x > ANCHO_NIVEL - 80 && estado === "jugando") { estado = "fin"; Musica.detener(); Musica.sfx("ganar"); mostrarMenu("¡Ganaste!", "Productos: " + puntos + " de " + productos.length, true, false, true); guardarPuntuacion(true); }

  camara = Math.max(0, Math.min(ANCHO_NIVEL - c.width, j.x - c.width / 3));
}

/* ============================================================
   DIBUJO
   ============================================================ */
function dibujarFondo() { // la pared de la tienda se mueve más lento que el juego (profundidad)
  const img = DISENO.fondo;
  if (!(img.complete && img.naturalWidth)) { ctx.fillStyle = "#46302c"; ctx.fillRect(0, 0, c.width, c.height); return; }
  const x = -((camara * PARALLAX) % 800);
  for (let k = 0; k < 2; k++) ctx.drawImage(img, 0, 0, 800, 500, x + k * 800, 0, 800, 500);
}

function dibujarPlataforma(p) {
  if (p.t === "suelo") {
    ctx.fillStyle = DISENO.suelo; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = DISENO.sueloTope; ctx.fillRect(p.x, p.y, p.w, 4);
  } else if (p.t === "caja") {
    ctx.fillStyle = DISENO.caja; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = DISENO.cajaLinea; ctx.lineWidth = 3; ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
    for (let y = p.y + 40; y < p.y + p.h; y += 40) { ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke(); }
  } else { // estante
    ctx.fillStyle = DISENO.estante; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = DISENO.estanteTope; ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.fillStyle = DISENO.estanteBorde; ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
  }
}

function dibujar() {
  dibujarFondo();
  ctx.save(); ctx.translate(-camara, 0);
  ctx.fillStyle = DISENO.abismo; ctx.fillRect(camara, SUELO, c.width, 60); // abismos
  for (const p of plataformas) dibujarPlataforma(p);
  for (const p of puntosControl) { // punto de control: se pone verde al activarlo
    ctx.fillStyle = "#ddd"; ctx.fillRect(p.x, SUELO - 50, 4, 50);
    ctx.fillStyle = p.ok ? "#22c55e" : "#ef4444"; ctx.fillRect(p.x + 4, SUELO - 50, 24, 16);
  }
  for (const m of productos) if (!m.tomado) {
    const flota = Math.sin(reloj / 15 + m.x) * 3; // los productos flotan
    dibujarSprite(SPRITES.producto, m.x - 18, m.y - 18 + flota, 36, 36, "p" + m.tipo, reloj);
  }
  for (const e of enemigos) {
    if (e.vivo) dibujarSprite(SPRITES[e.tipo], e.x, e.y, e.w, e.h, "caminar", reloj, e.dir < 0);
    else if (e.t > 0) { e.t--; dibujarSprite(SPRITES[e.tipo], e.x, e.y + e.h*0.7, e.w, e.h*0.3, "aplastado", reloj); }
  }
  dibujarSprite(SPRITES.bandera, ANCHO_NIVEL-60, SUELO - 140, 40, 140, "ondear", reloj);
  const j = jugador;
  if (j.inmune % 8 < 4) {
    const anim = !j.suelo ? "saltar" : j.vx !== 0 ? "correr" : "quieto";
    dibujarSprite(SPRITES.jugador, j.x + j.w/2 - 30, j.y + j.h - 44, 60, 48, anim, reloj, j.dir < 0);
  }
  ctx.restore();
  dibujarVidas();
}

/* ============================================================
   COMUNICACIÓN CON DJANGO (API JSON → base de datos SQL)
   ============================================================ */
async function guardarPuntuacion(gano) {
  try {
    await fetch(URL_GUARDAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": CSRF_TOKEN },
      body: JSON.stringify({ jugador: $("nombre").value.trim(), productos: puntos, gano })
    });
    await cargarRanking();
  } catch (err) { console.error("No se pudo guardar la puntuación", err); }
}

async function cargarRanking() {
  try {
    const datos = await (await fetch(URL_RANKING)).json();
    $("ranking").replaceChildren(...datos.map(p => {
      const li = document.createElement("li");
      li.textContent = p.jugador + ": " + p.productos + (p.gano ? " ★" : ""); // textContent evita inyección de HTML
      return li;
    }));
  } catch (err) { console.error("No se pudo cargar el ranking", err); }
}

function bucle() {
  if (estado === "jugando") actualizar();
  if (jugador) dibujar();
  requestAnimationFrame(bucle);
}
nuevoNivel(); actualizarHUD();
cargarRanking();
bucle();
