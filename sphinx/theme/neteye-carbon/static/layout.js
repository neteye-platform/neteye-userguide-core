function elementIsVisibleInContainer(elemSelector, containerSelector) {
  var container = $(containerSelector);
  var contHeight = container.height();

  var elem = $(elemSelector);
  var elemTop = elem.offset().top - container.offset().top;
  var elemBottom = elemTop + elem.height();

  var isTotal = elemTop >= 0 && elemBottom <= contHeight;
  var isPart =
    (elemTop < 0 && elemBottom > 0) ||
    (elemTop > 0 && elemTop <= container.height());

  return isTotal || isPart;
}

$(document).ready(function () {
  $(".mobile-local-toc #local-toc-nav .nav a").hide();
  var el = $(".mobile-local-toc #local-toc-nav .nav a.active").last();
  if (el.length) {
    el.show();
  } else {
    $(".mobile-local-toc #local-toc-nav .nav a").first().show();
  }
  if (!$(".mobile-local-toc #local-toc-nav .nav .nav-link").length) {
    $(".mobile-local-toc").hide();
  }
});

$(window).on("activate.bs.scrollspy", function () {
  if (!$(".mobile-local-toc").hasClass("menu-close")) {
    return;
  }

  $(".mobile-local-toc #local-toc-nav .nav a").hide();
  $(".mobile-local-toc #local-toc-nav .nav a.active").last().show();

  /* Scroll the local toc if the active element is not visible */
  var activeElements = document.querySelectorAll(
    ".right-column #local-toc-nav .nav-link.active",
  );
  if (activeElements.length) {
    var activeElement = activeElements[activeElements.length - 1];
    var container = document.querySelector(
      ".right-column #local-toc-nav > .nav",
    );
    if (!elementIsVisibleInContainer(activeElement, container)) {
      container.scrollTop = activeElement.offsetTop;
    }
  }
});

$(document).on("click", ".mobile-local-toc.menu-close", function () {
  $(".mobile-local-toc").toggleClass("menu-close");
  $(".mobile-local-toc #local-toc-nav .nav a").show();
});

$(document).on(
  "click",
  ".mobile-local-toc:not(.menu-close) .expand-icon, .mobile-local-toc:not(.menu-close) .nav-link",
  function () {
    $(".mobile-local-toc").toggleClass("menu-close");
    $(".mobile-local-toc #local-toc-nav .nav a").hide();
    if ($(".mobile-local-toc #local-toc-nav .nav .nav-link.active").length) {
      $(".mobile-local-toc #local-toc-nav .nav .nav-link.active").last().show();
    } else {
      $(".mobile-local-toc #local-toc-nav .nav .nav-link").first().show();
    }
  },
);
