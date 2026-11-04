/* Configuración opcional. Si el archivo va a estar en internet, deja URL_APP y CLAVE vacías
   y conecta desde Ajustes (queda guardado solo en tu dispositivo). */
var CONFIG = {
  URL_APP: '',
  CLAVE: '',
  URL_HOJA: ''
};

var APP_VERSION = '4.0';
var URL_PUBLICA = 'https://chloe3d-hub.github.io/purchasetracker/';
/* Lista de productos del catálogo web (mismo sitio de GitHub Pages). Solo sirve para sugerir nombres al crear fichas. */
var CATALOGO_URL = 'https://chloe3d-hub.github.io/Catalogo/data/products.json';
var ESTADOS = ['Recibido', 'En producción', 'Listo para entrega', 'Enviado', 'Entregado', 'Cancelado'];
var OTRO = '__otro__';
var LISTAS_BASE = {
  productos: ['Máscaras', 'Aretes', 'Cuadros', 'Mascotas', 'Decoración para la Casa', 'Gaming', 'Lámparas', 'Negocios', 'Organizadores', 'Regreso a Clases', 'Halloween', 'Navidad', 'Smokeshop'],
  canales: ['Marketplace', 'WhatsApp', 'MercadoLibre', 'TikTok', 'Instagram', 'Feria', 'Referido'],
  metodos: ['Nequi', 'Daviplata', 'Transferencia', 'Efectivo'],
  transportadoras: ['Servientrega', 'Interrapidísimo', 'Coordinadora', 'Envía', 'Moto mensajero']
};
/* Ajustes que de fábrica trae el script. Los precios arrancan en 0: los pones tú en Ajustes. */
var CONFIG_BASE = {
  impresoras: [{ nombre: 'Flashforge Creator 5', costoHora: 0 }, { nombre: 'Bambu Lab P1S', costoHora: 0 }],
  costoGramo: 0,
  luzKwh: 0,
  empaque: 0,
  componentes: [],
  listas: {},
  gastoCategorias: ['Filamento', 'Empaques', 'Envíos', 'Publicidad', 'Repuestos y mantenimiento', 'Electricidad', 'Equipos y herramientas', 'Componentes electrónicos', 'Otros'],
  calendario: false,
  resumen: false,
  resumenHora: 7,
  resumenEmail: '',
  respaldo: false
};
var LS = { cfg: 'ys.cfg.v1', listas: 'ys.listas.v2', pend: 'ys.pend.v1', pendg: 'ys.pendg.v1', cache: 'ys.cache.v1', datos: 'ys.datos.v3', migrado: 'ys.migrado.v3', ultimaVista: 'ys.vista.v3', catalogo: 'ys.catalogo.v1' };
var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
