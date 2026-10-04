/*!
 * Aurien — comportamentos próprios deste site.
 * O motor (sites-incriveis.js) cuida das revelações e das cenas fixas; o que
 * é só da Aurien mora aqui: o assentamento do cotidiano e a fita de marca.
 */
(function () {
  "use strict";

  var reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===================================================================
     1. O movimento-assinatura — "a desordem que se assenta"
     Os itens do cotidiano vagam soltos; a rolagem é a única força que os
     organiza. Cada item tem inércia própria: demora e caminho diferentes.
     =================================================================== */

  (function assentamento() {
    var cena = document.getElementById("cotidiano");
    var enxame = document.getElementById("enxame");
    if (!cena || !enxame) return;

    var itens = [].slice.call(enxame.querySelectorAll(".item"));
    var dizeres = [].slice.call(cena.querySelectorAll(".pico__dizer"));
    if (!itens.length) return;

    // sorteio estável: a mesma bagunça a cada visita, nunca um layout diferente
    function sorteio(semente) {
      var s = semente * 9301 + 49297;
      return function () {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }

    var plano = [];

    function medir() {
      var caixa = enxame.getBoundingClientRect();
      var L = caixa.width, A = caixa.height;
      if (!L || !A) return;

      // os visíveis agora (no celular alguns itens saem do ar)
      var ativos = itens.filter(function (el) {
        return getComputedStyle(el).display !== "none";
      });

      var alturaItem = ativos[0] ? ativos[0].offsetHeight : 42;
      var passo = alturaItem + (L < 620 ? 9 : 13);
      var alturaColuna = passo * (ativos.length - 1);
      var larguraMaior = Math.max.apply(null, ativos.map(function (el) { return el.offsetWidth; }));

      plano = itens.map(function (el) {
        var i = ativos.indexOf(el);
        if (i < 0) return null;
        var r = sorteio(i + 3);
        var lado = i % 2 === 0 ? -1 : 1;
        return {
          el: el,
          // de onde vem: espalhado, torto, cada um no seu canto
          x0: lado * (0.14 + r() * 0.30) * L,
          y0: (r() - 0.5) * A * 0.86,
          giro0: (r() - 0.5) * 26,
          // para onde vai: coluna alinhada pela esquerda, ordenada
          x1: -larguraMaior / 2 + el.offsetWidth / 2,
          y1: -alturaColuna / 2 + i * passo,
          // inércia própria: uns param antes, outros depois
          atraso: 0.04 + (i / ativos.length) * 0.30,
          duracao: 0.40 + r() * 0.20
        };
      });
    }

    function suave(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }

    function aplicar(p) {
      for (var i = 0; i < plano.length; i++) {
        var a = plano[i];
        if (!a) continue;
        var t = suave((p - a.atraso) / a.duracao);
        var x = a.x0 + (a.x1 - a.x0) * t;
        var y = a.y0 + (a.y1 - a.y0) * t;
        var g = a.giro0 * (1 - t);
        a.el.style.transform =
          "translate(calc(-50% + " + x.toFixed(1) + "px), calc(-50% + " + y.toFixed(1) + "px))" +
          " rotate(" + g.toFixed(2) + "deg)";
        a.el.setAttribute("data-assentado", t > 0.92 ? "sim" : "nao");
      }

      var vivo = p < 0.30 ? 0 : p < 0.62 ? 1 : 2;
      for (var j = 0; j < dizeres.length; j++) {
        dizeres[j].setAttribute("data-vivo", j === vivo ? "sim" : "nao");
      }
    }

    if (reduzido) {
      // parado, a cena já é a resposta: a lista organizada e a frase final
      dizeres.forEach(function (d, j) { d.setAttribute("data-vivo", j === 2 ? "sim" : "nao"); });
      itens.forEach(function (el) { el.setAttribute("data-assentado", "sim"); });
      return;
    }

    medir();
    window.addEventListener("resize", medir, { passive: true });

    var ultimo = -1;
    (function quadro() {
      var p = parseFloat(getComputedStyle(cena).getPropertyValue("--progresso"));
      if (isNaN(p)) p = 0;
      if (p !== ultimo) { aplicar(p); ultimo = p; }
      requestAnimationFrame(quadro);
    })();
  })();

  /* ===================================================================
     2. A fita — presença de marca
     Não é mais o pico da página: é o objeto da marca, respirando devagar.
     =================================================================== */

  (function fitaDeMarca() {
    var alvos = [].slice.call(document.querySelectorAll(".fita-marca"));
    if (!alvos.length || !window.FitaAurien || !window.FITA_AURIEN_DADOS) return;

    var D = window.FITA_AURIEN_DADOS;
    var vb = D.viewBox;
    var estreito = window.matchMedia("(max-width: 760px)").matches;

    alvos.forEach(function (caixa) {
      var cv = document.createElement("canvas");
      caixa.appendChild(cv);

      var fita = window.FitaAurien.criar(cv, {
        viewBox: vb,
        largura: D.largura,
        espessura: 7,
        repouso: D.repouso,
        aberta: D.aberta,
        torcaoRepouso: D.torcaoRepouso,
        torcaoAberta: D.torcaoAberta,
        cores: D.cores,
        camera: 1250,
        segmentos: estreito ? 150 : 240,
        centro: [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, 0]
      });

      function dimensionar() {
        var r = caixa.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.max(1, Math.round(r.width * dpr));
        cv.height = Math.max(1, Math.round(r.height * dpr));
        cv.style.width = "100%";
        cv.style.height = "100%";
      }

      dimensionar();
      window.addEventListener("resize", function () {
        dimensionar();
        desenhar(ultimoT);
      }, { passive: true });

      var ultimoT = 0;
      function desenhar(t) {
        ultimoT = t;
        // oscilação curta: a fita é quase plana, girar demais a faria sumir
        fita.ajustar({
          p: 0,
          giroY: Math.sin(t * 0.00033) * 17,
          giroX: Math.cos(t * 0.00027) * 5 - 4,
          escala: 1
        });
        fita.desenhar();
      }

      if (reduzido) { desenhar(0); return; }

      // só anima enquanto está na tela: fora dela, não gasta nada
      var visivel = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (e) { visivel = e[0].isIntersecting; },
          { rootMargin: "120px" }).observe(caixa);
      }

      (function laco(t) {
        if (visivel) desenhar(t);
        requestAnimationFrame(laco);
      })(0);
    });
  })();

  /* ===================================================================
     3. Marcar o item do menu da página atual
     =================================================================== */

  (function menuAtual() {
    var aqui = location.pathname.replace(/index\.html$/, "");
    [].slice.call(document.querySelectorAll(".topo__menu a")).forEach(function (a) {
      var destino = a.getAttribute("href");
      if (!destino || destino.charAt(0) === "#") return;
      var url = new URL(destino, location.href).pathname.replace(/index\.html$/, "");
      if (url !== "/" && aqui.indexOf(url) === 0) a.setAttribute("aria-current", "page");
    });
  })();

})();
