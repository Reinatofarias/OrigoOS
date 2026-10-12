// Script pra colar no Google Ads (Ferramentas > Ações em massa > Scripts). Roda todo dia e manda os números pro Origo OS.
// Funciona numa conta só ou numa conta de administrador (MCC), passando por todas as contas.
export function scriptGoogle(url: string, token: string) {
  return `// Origo OS: envia os números do Google Ads todo dia.
var URL_ORIGO = '${url}';
var TOKEN_ORIGO = '${token}';

function coletar() {
  var conta = AdsApp.currentAccount();
  var fuso = conta.getTimeZone();
  var hoje = new Date();
  var inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  var de = Utilities.formatDate(inicio, fuso, 'yyyy-MM-dd');
  var ate = Utilities.formatDate(new Date(hoje.getTime() - 86400000), fuso, 'yyyy-MM-dd');
  var linhas = AdsApp.search(
    "SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions " +
    "FROM customer WHERE segments.date BETWEEN '" + de + "' AND '" + ate + "'"
  );
  var dias = [];
  while (linhas.hasNext()) {
    var l = linhas.next();
    dias.push({
      data: l.segments.date,
      investimento: Number(l.metrics.costMicros || 0) / 1000000,
      impressoes: Number(l.metrics.impressions || 0),
      cliques: Number(l.metrics.clicks || 0),
      conversoes: Number(l.metrics.conversions || 0)
    });
  }
  return { conta: conta.getCustomerId(), nome: conta.getName(), dias: dias };
}

function main() {
  var contas = [];
  if (typeof AdsManagerApp !== 'undefined') {
    var it = AdsManagerApp.accounts().get();
    while (it.hasNext()) {
      AdsManagerApp.select(it.next());
      contas.push(coletar());
    }
  } else {
    contas.push(coletar());
  }
  var r = UrlFetchApp.fetch(URL_ORIGO, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-origo-token': TOKEN_ORIGO },
    payload: JSON.stringify({ contas: contas }),
    muteHttpExceptions: true
  });
  Logger.log('Origo OS respondeu ' + r.getResponseCode() + ': ' + r.getContentText());
}
`;
}
