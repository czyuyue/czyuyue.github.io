// Shared helpers for blog.html and post.html.

/** Split "---\nkey: value\n---\nbody" into {meta: {key: value}, body}. */
function parseFrontMatter(text) {
  var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  var meta = {};
  m[1].split(/\r?\n/).forEach(function (line) {
    var i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { meta: meta, body: m[2] };
}

/** List published posts (blog/*.md, excluding _*.md), newest first. */
function listPosts() {
  return fetch("https://api.github.com/repos/czyuyue/czyuyue.github.io/contents/blog")
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (files) {
      var md = files.filter(function (f) {
        return f.type === "file" && /\.md$/i.test(f.name) && f.name.charAt(0) !== "_";
      });
      return Promise.all(md.map(function (f) {
        var slug = f.name.replace(/\.md$/i, "");
        return fetch("blog/" + encodeURIComponent(f.name), { cache: "no-cache" })
          .then(function (r) { return r.text(); })
          .then(function (t) { return { slug: slug, meta: parseFrontMatter(t).meta }; });
      }));
    })
    .then(function (posts) {
      return posts.sort(function (a, b) {
        return (b.meta.date || "").localeCompare(a.meta.date || "") || a.slug.localeCompare(b.slug);
      });
    })
    .catch(function () { return []; });
}
