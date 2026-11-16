/* Música: si existe el archivo cancion.mp3 en la carpeta, lo usa en bucle.
   Si no existe, usa una melodía hecha con código. Los efectos de sonido siempre son de código.
   Uso: Musica.iniciar() · Musica.pausar() · Musica.reanudar() · Musica.detener()
        Musica.alternar() (silenciar/activar) · Musica.sfx("salto") */
const Musica = (() => {
  let ac = null, master = null, timer = null, paso = 0, proximo = 0, activa = true;
  let cancion = null, usaCancion = false;      // cancion = tu archivo mp3
  const PASO = 60 / 150 / 2;                       // 150 BPM, una nota por corchea
  const MELODIA = [                                 // 32 pasos (0 = silencio), números = notas MIDI
    76,0,79,0,84,0,79,0,  77,0,81,0,86,0,81,0,
    76,0,79,0,84,0,88,86, 84,81,79,77,76,0,0,0 ];
  const RAICES = [48, 53, 48, 43];                  // bajo: Do, Fa, Do, Sol
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function tono(f, t, dur, tipo, vol, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function programar() {                            // agenda las próximas notas
    while (proximo < ac.currentTime + 0.2) {
      const i = paso % 32, n = MELODIA[i];
      if (n) tono(hz(n), proximo, PASO * 0.9, "square", 0.05);
      if (i % 2 === 0) {
        const r = RAICES[Math.floor(i / 8)], b = [r, r, r + 7, r][(i % 8) / 2];
        tono(hz(b - 12), proximo, PASO * 1.8, "triangle", 0.13);
      }
      proximo += PASO; paso++;
    }
  }
  function iniciarChiptune() {
    paso = 0; proximo = ac.currentTime + 0.05;
    clearInterval(timer); timer = setInterval(programar, 50);
  }
  return {
    get activa() { return activa; },
    iniciar() {                                     // llamar al hacer clic (los navegadores lo exigen)
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = activa ? 0.8 : 0; master.connect(ac.destination);
      }
      ac.resume();
      if (!cancion) { cancion = new Audio((window.STATIC_URL || "") + "cancion.mp3"); cancion.loop = true; cancion.volume = 0.6; }
      cancion.currentTime = 0; cancion.muted = !activa;
      cancion.play().then(() => { usaCancion = true; })                          // encontró tu canción
        .catch(() => { usaCancion = false; iniciarChiptune(); });                // no hay mp3: usa la melodía de código
    },
    detener() { clearInterval(timer); timer = null; if (cancion) cancion.pause(); },
    pausar() { if (ac) ac.suspend(); if (cancion) cancion.pause(); },
    reanudar() { if (ac) ac.resume(); if (cancion && usaCancion) cancion.play(); },
    alternar() {
      activa = !activa; if (master) master.gain.value = activa ? 0.8 : 0;
      if (cancion) cancion.muted = !activa;
      return activa;
    },
    sfx(nombre) {
      if (!ac || !activa) return;
      const t = ac.currentTime;
      if (nombre === "salto") tono(300, t, 0.15, "square", 0.1, 700);
      else if (nombre === "salto2") tono(450, t, 0.15, "square", 0.1, 1000);
      else if (nombre === "producto") { tono(988, t, 0.07, "square", 0.1); tono(1319, t + 0.07, 0.18, "square", 0.1); }
      else if (nombre === "pisar") tono(220, t, 0.12, "square", 0.15, 70);
      else if (nombre === "golpe") tono(300, t, 0.35, "sawtooth", 0.15, 60);
      else if (nombre === "ganar") [523, 659, 784, 1047].forEach((f, i) => tono(f, t + i * 0.12, 0.25, "square", 0.1));
      else if (nombre === "perder") [392, 330, 262, 196].forEach((f, i) => tono(f, t + i * 0.2, 0.3, "triangle", 0.15));
    }
  };
})();
