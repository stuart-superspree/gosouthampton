// For static hosts that cannot rewrite /t/<id> to the app: turn it into /?t=<id>&...
(function () {
  var m = location.pathname.match(/^\/t\/([A-Za-z0-9]{3,16})\/?$/);
  if (m) location.replace('/?t=' + m[1] + (location.search ? '&' + location.search.slice(1) : ''));
})();
