# Writing a news post

1. Add a Markdown file to `_posts/` named `YYYY-MM-DD-short-title.md`.
   The date in the name is the post date; the rest becomes the URL
   (`/news/YYYY/short-title/`).
2. Start it with front matter:

   ```markdown
   ---
   title: "New paper on telomere repeats"
   summary: One or two sentences shown on the news list, the homepage and link previews.
   ---

   The post itself, in Markdown. Links, **bold**, lists and images all work:

   ![Describe the image for screen readers](/img/your-image.jpg)
   ```

   Quote the title if it contains a colon.
3. Put images in `img/` and reference them as `/img/name.jpg`.
4. Commit and push to `master` (or use "Add file" on github.com). GitHub
   rebuilds the site in about a minute. The homepage shows the latest three
   posts and `/news/feed.xml` is the RSS feed.

The news page and posts use `_layouts/default.html`, which has its own copy
of the header and footer: when the nav changes on the other pages, change it
there too.
