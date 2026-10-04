/* Aurien — o único script do site.
 *
 * Faz uma coisa só: deixa os blocos aparecerem uma vez, quando entram na
 * tela. Tudo o mais é CSS.
 *
 * A classe .js é posta no <html> por um script curto no <head>, antes de
 * pintar. Só com ela o CSS esconde os blocos para a entrada — se este
 * arquivo não carregar, o conteúdo continua visível. */
(function () {
  "use strict";

  var alvos = document.querySelectorAll(".revelar");
  if (!alvos.length) return;

  var parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sem IntersectionObserver, ou com movimento reduzido: mostra tudo de uma vez.
  if (parado || !("IntersectionObserver" in window)) {
    for (var i = 0; i < alvos.length; i++) alvos[i].classList.add("visivel");
    return;
  }

  var observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("visivel");
      observador.unobserve(e.target);     // acontece uma vez só
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

  for (var j = 0; j < alvos.length; j++) observador.observe(alvos[j]);
})();
