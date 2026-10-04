/*!
 * Fita Aurien em 3D — geometria de verdade, não recorte.
 *
 * A fita é uma faixa com espessura que percorre uma curva fechada no espaço.
 * Em repouso, a projeção dessa faixa reproduz o símbolo oficial da Aurien; ao
 * se desdobrar, a curva abre de forma contínua — o material nunca se descola,
 * porque é um corpo só.
 *
 * Sem dependência externa. Canvas 2D, ordenação por profundidade.
 * Respeita prefers-reduced-motion: quem usa a fita decide o que fazer.
 */
(function (raiz) {
  "use strict";

  /* ============================ álgebra mínima ============================ */

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function esc(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function cruz(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function ponto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norma(a) {
    var n = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / n, a[1] / n, a[2] / n];
  }

  // Catmull-Rom fechada: passa por todos os pontos de controle
  function catmull(pontos, t) {
    var n = pontos.length;
    var f = t * n;
    var i = Math.floor(f);
    var u = f - i;
    var p0 = pontos[(i - 1 + n) % n], p1 = pontos[i % n];
    var p2 = pontos[(i + 1) % n], p3 = pontos[(i + 2) % n];
    var u2 = u * u, u3 = u2 * u;
    var r = [];
    for (var k = 0; k < 3; k++) {
      r[k] = 0.5 * (
        2 * p1[k] +
        (-p0[k] + p2[k]) * u +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3
      );
    }
    return r;
  }

  // interpolação de um perfil definido por pares [t, valor], t de 0 a 1
  function perfil(pares, t) {
    t = ((t % 1) + 1) % 1;
    for (var i = 0; i < pares.length - 1; i++) {
      if (t >= pares[i][0] && t <= pares[i + 1][0]) {
        var a = pares[i], b = pares[i + 1];
        var u = (t - a[0]) / (b[0] - a[0] || 1);
        var s = u * u * (3 - 2 * u);              // suaviza as junções
        return a[1] + (b[1] - a[1]) * s;
      }
    }
    return pares[pares.length - 1][1];
  }

  function misturar(a, b, k) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k)
    ];
  }

  // cor ao longo da fita, a partir de paradas [t, [r,g,b]]
  function corEm(paradas, t) {
    t = ((t % 1) + 1) % 1;
    for (var i = 0; i < paradas.length - 1; i++) {
      if (t >= paradas[i][0] && t <= paradas[i + 1][0]) {
        var a = paradas[i], b = paradas[i + 1];
        var u = (t - a[0]) / (b[0] - a[0] || 1);
        return misturar(a[1], b[1], u);
      }
    }
    return paradas[paradas.length - 1][1];
  }

  /* ========================= a fita propriamente ========================= */

  function criar(canvas, opcoes) {
    opcoes = opcoes || {};
    var ctx = canvas.getContext("2d");

    var SEGMENTOS = opcoes.segmentos || 260;
    var LARGURA = opcoes.largura || 97;     // unidades do símbolo
    var ESPESSURA = opcoes.espessura || 7;

    // controle da curva: repouso e aberta. A animação mistura os dois.
    var REPOUSO = opcoes.repouso;
    var ABERTA = opcoes.aberta;
    var TORCAO_REPOUSO = opcoes.torcaoRepouso;
    var TORCAO_ABERTA = opcoes.torcaoAberta;
    var CORES = opcoes.cores;

    var LUZ = norma(opcoes.luz || [-0.42, -0.72, 0.55]);
    var CAMERA = opcoes.camera || 1250;      // distância focal
    var centroVista = opcoes.centro || [341, 225, 0];

    var estado = { p: 0, giroY: 0, giroX: 0, escala: 1, destaque: null };

    function controles(p) {
      var r = [];
      for (var i = 0; i < REPOUSO.length; i++) {
        r.push([
          REPOUSO[i][0] + (ABERTA[i][0] - REPOUSO[i][0]) * p,
          REPOUSO[i][1] + (ABERTA[i][1] - REPOUSO[i][1]) * p,
          REPOUSO[i][2] + (ABERTA[i][2] - REPOUSO[i][2]) * p
        ]);
      }
      return r;
    }

    // monta os anéis da fita: para cada passo, as quatro quinas da seção
    function montar(p) {
      var pts = controles(p);
      var aneis = [];
      var anterior = null;

      for (var i = 0; i <= SEGMENTOS; i++) {
        var t = i / SEGMENTOS;
        var c = catmull(pts, t);
        var adiante = catmull(pts, t + 0.0015);
        var tangente = norma(sub(adiante, c));

        // referencial que não gira sozinho: carrega o anterior adiante
        var normal;
        if (!anterior) {
          normal = norma(cruz(tangente, [0, 0, 1]));
          if (!isFinite(normal[0])) normal = [1, 0, 0];
        } else {
          var proj = sub(anterior, esc(tangente, ponto(anterior, tangente)));
          normal = norma(proj);
        }
        anterior = normal;

        var tor = (perfil(TORCAO_REPOUSO, t) * (1 - p) + perfil(TORCAO_ABERTA, t) * p) * Math.PI / 180;
        var binormal = norma(cruz(tangente, normal));
        var larg = add(esc(normal, Math.cos(tor)), esc(binormal, Math.sin(tor)));
        var alt = cruz(tangente, larg);

        var meia = esc(larg, LARGURA / 2);
        var meiaEsp = esc(alt, ESPESSURA / 2);

        aneis.push({
          t: t,
          cima: [add(add(c, meia), meiaEsp), add(sub(c, meia), meiaEsp)],
          baixo: [add(add(c, meia), esc(meiaEsp, -1)), add(sub(c, meia), esc(meiaEsp, -1))],
          normalCima: alt,
          largura: larg
        });
      }
      return aneis;
    }

    function girar(v) {
      var ax = estado.giroY * Math.PI / 180, ay = estado.giroX * Math.PI / 180;
      var x = v[0] - centroVista[0], y = v[1] - centroVista[1], z = v[2] - centroVista[2];
      var x1 = x * Math.cos(ax) + z * Math.sin(ax);
      var z1 = -x * Math.sin(ax) + z * Math.cos(ax);
      var y1 = y * Math.cos(ay) - z1 * Math.sin(ay);
      var z2 = y * Math.sin(ay) + z1 * Math.cos(ay);
      return [x1, y1, z2];
    }

    function projetar(v, caixa) {
      var g = girar(v);
      var k = CAMERA / (CAMERA - g[2]);
      return {
        x: caixa.cx + g[0] * k * caixa.k * estado.escala,
        y: caixa.cy + g[1] * k * caixa.k * estado.escala,
        z: g[2]
      };
    }

    function desenhar() {
      var L = canvas.width, A = canvas.height;
      ctx.clearRect(0, 0, L, A);

      var vb = opcoes.viewBox || [115, 31, 452, 388];
      var k = Math.min(L / vb[2], A / vb[3]) * 0.92;
      var caixa = { cx: L / 2, cy: A / 2, k: k };

      var aneis = montar(estado.p);
      var faces = [];

      for (var i = 0; i < aneis.length - 1; i++) {
        var a = aneis[i], b = aneis[i + 1];
        var cor = corEm(CORES, (a.t + b.t) / 2);

        // face de cima, face de baixo e as duas arestas de espessura
        faces.push({ v: [a.cima[0], a.cima[1], b.cima[1], b.cima[0]], n: a.normalCima, cor: cor, lado: 1 });
        faces.push({ v: [a.baixo[0], b.baixo[0], b.baixo[1], a.baixo[1]], n: esc(a.normalCima, -1), cor: cor, lado: -1 });
        faces.push({ v: [a.cima[0], b.cima[0], b.baixo[0], a.baixo[0]], n: a.largura, cor: cor, lado: 0 });
        faces.push({ v: [a.cima[1], a.baixo[1], b.baixo[1], b.cima[1]], n: esc(a.largura, -1), cor: cor, lado: 0 });
      }

      // projeta e ordena do fundo para a frente
      var prontas = faces.map(function (f) {
        var pr = f.v.map(function (v) { return projetar(v, caixa); });
        var z = (pr[0].z + pr[1].z + pr[2].z + pr[3].z) / 4;
        return { pr: pr, z: z, n: f.n, cor: f.cor, lado: f.lado };
      });
      prontas.sort(function (x, y) { return x.z - y.z; });

      for (var j = 0; j < prontas.length; j++) {
        var f = prontas[j];
        var n = girar(add(f.n, centroVista));      // a normal acompanha a câmera
        n = norma(n);
        if (n[2] < 0) n = esc(n, -1);              // a face sempre encara quem vê

        var difusa = Math.max(0, ponto(n, LUZ));
        var rasante = Math.pow(1 - Math.abs(n[2]), 2.4);          // brilho de borda
        // especular: meio-vetor entre a luz e o olho
        var meio = norma([LUZ[0], LUZ[1], LUZ[2] + 1]);
        var brilho = Math.pow(Math.max(0, ponto(n, meio)), 22);

        // A cor-base já vem sombreada da arte; a luz aqui só modela o volume,
        // em torno de 1 — multiplicar por menos que isso escurece duas vezes.
        var luz = 0.78 + 0.34 * difusa + 0.20 * rasante;
        if (f.lado === -1) luz *= 0.66;                            // o verso, mais fosco
        if (f.lado === 0) luz *= 0.88;                             // a espessura, no meio

        var c = f.cor;
        var realce = f.lado === 1 ? brilho * 92 : 0;
        ctx.beginPath();
        ctx.moveTo(f.pr[0].x, f.pr[0].y);
        for (var q = 1; q < 4; q++) ctx.lineTo(f.pr[q].x, f.pr[q].y);
        ctx.closePath();
        var cor = "rgb(" +
          Math.min(255, Math.round(c[0] * luz + realce)) + "," +
          Math.min(255, Math.round(c[1] * luz + realce)) + "," +
          Math.min(255, Math.round(c[2] * luz + realce)) + ")";
        ctx.fillStyle = cor;
        ctx.strokeStyle = cor;       // costura as quinas: sem fresta entre quads
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      }
    }

    return {
      ajustar: function (novo) {
        for (var k2 in novo) if (novo.hasOwnProperty(k2)) estado[k2] = novo[k2];
        return this;
      },
      estado: estado,
      desenhar: desenhar
    };
  }

  raiz.FitaAurien = { criar: criar };
})(typeof window !== "undefined" ? window : this);
