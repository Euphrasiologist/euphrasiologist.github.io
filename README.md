# My static website

To build the site:

```bash
cargo build --release
```

For development:

```bash
cargo build --release && ./target/release/web_server -s
```

## Notes

Markdowns added to the `content` dir need to be in the following format:

```
<name of post> - <date> (where date = {%d.%m.%Y})
```

Add the `public` dir to be the published root:

```bash
git subtree push --prefix public origin gh-pages
```

## Thanks

Thanks to https://github.com/jiyuujin/static_generator/blob/main/src/main.rs, on which this site is built.