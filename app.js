// Dashboards de cada grupo. Para agregar un grupo nuevo: poner aquí su enlace de
// "Publicar en la web" de Power BI y cambiar su tarjeta en index.html de div a enlace (#clave).
var MODULOS = {
  parking: {
    nombre: "Smart Parking",
    vivo: true,
    url: "https://app.powerbi.com/view?r=eyJrIjoiYTgwZTY5OTUtOWMyNi00OWNhLThiNTYtMzYyZjU4N2E5YTk0IiwidCI6IjA3ZGE2N2EwLTFmNDMtNGU4Yy05NzdmLTVmODhiNjQ3MGVlNiIsImMiOjR9"
  },
  residuos: {
    nombre: "Smart Waste & Recycling",
    url: "https://app.powerbi.com/view?r=eyJrIjoiZDJkZGE4YzYtN2IxNi00ZmIyLTllZWMtNzg3MjljYTFmYTkxIiwidCI6IjA3ZGE2N2EwLTFmNDMtNGU4Yy05NzdmLTVmODhiNjQ3MGVlNiIsImMiOjR9"
  },
  green: {
    nombre: "SmartGreenZone",
    url: "https://app.powerbi.com/view?r=eyJrIjoiOTI4ZGUwMjYtYjU4Mi00Y2MwLWI4OTUtMTkxMWQxMDIxMjhjIiwidCI6IjA3ZGE2N2EwLTFmNDMtNGU4Yy05NzdmLTVmODhiNjQ3MGVlNiIsImMiOjR9"
  },
   lighting: {
    nombre: "Smart Lighting",
    url: "https://app.powerbi.com/view?r=eyJrIjoiMGYzOTY1NzgtYWRkYi00NWIwLTk2NzgtNDI3YTI0NTRhZjVjIiwidCI6IjA3ZGE2N2EwLTFmNDMtNGU4Yy05NzdmLTVmODhiNjQ3MGVlNiIsImMiOjR9"
  }
  
};

(function () {
  var visor = document.getElementById("visor");
  var marco = document.getElementById("visor-marco");
  var titulo = document.getElementById("visor-titulo");
  var externo = document.getElementById("visor-externo");
  var pestanas = document.getElementById("pestanas");
  var tabH = document.getElementById("tab-historico");
  var tabV = document.getElementById("tab-vivo");
  var vivo = document.getElementById("vivo");
  var abierto = null;

  function sincronizar() {
    var hash = location.hash.slice(1);
    var enVivo = /-vivo$/.test(hash);
    var clave = enVivo ? hash.replace(/-vivo$/, "") : hash;
    var m = MODULOS[clave];
    if (!m) {
      if (visor.open) visor.close();
      marco.removeAttribute("src");
      abierto = null;
      return;
    }
    if (abierto !== clave) {
      titulo.textContent = "Dashboard de " + m.nombre;
      marco.title = "Dashboard de " + m.nombre + " en Power BI";
      marco.src = m.url;
      externo.href = m.url;
      pestanas.hidden = !m.vivo;
      abierto = clave;
    }
    var mostrarVivo = !!(m.vivo && enVivo);
    marco.hidden = mostrarVivo;
    vivo.hidden = !mostrarVivo;
    tabH.removeAttribute("aria-current");
    tabV.removeAttribute("aria-current");
    (mostrarVivo ? tabV : tabH).setAttribute("aria-current", "page");
    if (mostrarVivo) iniciarVivo();
    if (!visor.open) visor.showModal();
  }

  // Esc cierra el visor: se deja la dirección sin clave para que no se reabra
  visor.addEventListener("close", function () {
    if (location.hash.length > 1 && location.hash !== "#modulos") {
      history.replaceState(null, "", location.pathname + location.search + "#modulos");
    }
    marco.removeAttribute("src");
    abierto = null;
  });

  window.addEventListener("hashchange", sincronizar);
  sincronizar();

  // ---------- estado en vivo de la maqueta de Smart Parking ----------
  // El navegador se suscribe al mismo servidor de mensajes (HiveMQ) donde publica el ESP32.
  var vivoIniciado = false;
  function iniciarVivo() {
    if (vivoIniciado) return;
    vivoIniciado = true;
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mqtt@5.3.4/dist/mqtt.min.js";
    s.onload = conectar;
    s.onerror = function () { document.getElementById("ev-estado").textContent = "No se pudo cargar la conexión con la maqueta."; };
    document.head.appendChild(s);
  }

  function conectar() {
    var BASE = "smartparking/sp01/";
    var estado = document.getElementById("ev-estado");
    var plano = document.getElementById("ev-espacios");
    var cont = document.getElementById("ev-resumen");
    var log = document.getElementById("ev-log");
    var edad = document.getElementById("ev-edad");
    var esp = { 1: null, 2: null, 3: null, 4: null };
    var libres = null, ocupados = null, ultimo = null;

    function aBool(txt) {
      var t = String(txt).trim().toLowerCase();
      try {
        var j = JSON.parse(t);
        if (typeof j === "object" && j !== null) {
          var v = j.ocupado !== undefined ? j.ocupado : (j.estado !== undefined ? j.estado : j.valor);
          return v === undefined ? null : aBool(v);
        }
        if (typeof j === "number") return j !== 0;
        if (typeof j === "boolean") return j;
      } catch (e) {}
      if (/^(libre|free|0|false|disponible)/.test(t)) return false;
      if (/ocup|^1$|true|busy/.test(t)) return true;
      return null;
    }
    function aNum(txt) {
      var n = parseInt(String(txt).replace(/[^0-9-]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function pintar() {
      var html = "";
      for (var i = 1; i <= 4; i++) {
        var v = esp[i];
        var cls = v === null ? "ev-nd" : (v ? "ev-oc" : "ev-li");
        var txt = v === null ? "sin dato" : (v ? "Ocupado" : "Libre");
        html += '<div class="ev-esp ' + cls + '"><span>Espacio ' + i + "</span><b>" + txt + "</b></div>";
      }
      plano.innerHTML = html;
      var lib = libres, oc = ocupados;
      if (lib === null && oc === null) {
        var a = 0, b = 0;
        for (var j = 1; j <= 4; j++) { if (esp[j] === false) a++; if (esp[j] === true) b++; }
        if (a + b > 0) { lib = a; oc = b; }
      }
      cont.textContent = lib === null ? "Esperando datos" : lib + " libres, " + (oc === null ? "?" : oc) + " ocupados";
    }

    var cli = mqtt.connect("wss://broker.hivemq.com:8884/mqtt", { clientId: "ciudad_" + Math.random().toString(16).slice(2, 10), reconnectPeriod: 4000 });
    cli.on("connect", function () { estado.textContent = "Conectado. Esperando mensajes de la maqueta."; cli.subscribe(BASE + "#"); });
    cli.on("reconnect", function () { estado.textContent = "Reconectando..."; estado.className = ""; });
    cli.on("error", function () { estado.textContent = "No hay conexión con el servidor de mensajes."; estado.className = ""; });
    cli.on("message", function (t, buf) {
      var m = buf.toString();
      var r = t.slice(BASE.length);
      var mm = r.match(/^espacios\/([1-4])$/);
      if (mm) esp[mm[1]] = aBool(m);
      else if (r === "conexion") {
        var on = /online|conectad|1|true/i.test(m) && !/offline/i.test(m);
        estado.textContent = on ? "Maqueta conectada y enviando datos." : "Maqueta apagada: se muestra el último estado guardado.";
        estado.className = on ? "ev-ok" : "";
      }
      else if (r === "libres") libres = aNum(m);
      else if (r === "ocupados") ocupados = aNum(m);
      ultimo = new Date();
      var li = document.createElement("li");
      li.textContent = ultimo.toLocaleTimeString("es-CO") + "  " + r + "  " + (m.length > 60 ? m.slice(0, 60) + "..." : m);
      log.insertBefore(li, log.firstChild);
      while (log.children.length > 6) log.removeChild(log.lastChild);
      pintar();
    });
    pintar();
    setInterval(function () {
      if (ultimo) edad.textContent = "Último mensaje hace " + Math.round((new Date() - ultimo) / 1000) + " s";
    }, 1000);
  }
})();
