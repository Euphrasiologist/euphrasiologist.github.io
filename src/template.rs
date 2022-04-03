/// The header for all HTMLs in the website.
///
/// As such, contains all `<style>` information.
pub const HEADER: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- For syntax highlighting -->
  <link rel="stylesheet"
      href="https://unpkg.com/@highlightjs/cdn-assets@11.5.0/styles/nord.min.css">
  <script src="//unpkg.com/@highlightjs/cdn-assets@11.5.0/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
  <script>
  console.log(`%cWelcome to Max Carter-Brown's (my) website!
    %cYou can see my source code at https://github.com/Euphrasiologist/euphrasiologist.github.io`,
    "color: #FE612C; font-weight: bold; font-size: 18px;",
    "color: #0f82f2; font-weight: bold;");
  </script>
  <style>
    body {
      background-color: white;
    }

    header h1 {
      font-family: roboto;
      color: black;
      text-align: center;
    }

    header h1:hover {
      color: #FE612C;
    }

    p {
      font-family: roboto;
      font-size: 16px;
    }

    a:hover {
      color: #FE612C;
    }

    .home_link {
      font-family: roboto;
      text-align: center;
      font-size: 22px;
    }
    
    #home_link {
      color: black;
    }
    
    #home_link:hover {
      color: #FE612C;
    }
    
    .about_link {
      font-family: roboto;
      text-align: center;
      font-size: 22px;
    }
    
    #about_link {
      color: black;
    }

    #about_link:hover {
      color: #FE612C;
    }

    .blog_link {
      font-family: roboto;
      text-align: center;
      font-size: 20px;
    }
    
    #blog_link {
      color: blue;
    }

    #blog_link:hover {
      color: #FE612C;
    }

    .blog_date {
      float: right;
      position: relative;
      bottom: 15px;
      text-align: center;
      font-family: monospace;
      font-size: 12px;
      color: #FE612C;
    }

    .header_text {

    }

    .footer_text {
      text-align: center;
      font-family: monospace;
      font-size: 12px;
      color: #FE612C;
    }

    .welcome_anchor {
      margin: auto;
      width: 80%;
      padding: 10px;
      font-size: 26px;
    }

    .content {
      margin: auto;
      width: 80%;
      padding: 10px;
    }

  </style>
  <title>Max Carter-Brown</title>
  </head>
"#;

/// Render the body of the HTMLs.
pub fn render_body(body: &str) -> String {
    format!(
        r#"  <body>
    <header>
      <h1 class="header_text">Max Carter-Brown</h1>
    </header>
    <main>
      <!-- Do I want a welcome anchor? -->
      <!-- <p class="welcome_anchor"></p> -->
      <section>
        <div class="home_link">
          <a href="/" id="home_link">Home</a>
        </div>
        <div class="about_link">
          <a href="/about.html" id="about_link">About</a>
        </div>
        <br/>
        <div class="content">
          {}
        </div>
      </section>

      <p class="footer_text">Made with Rust & love.</p>
    </main>
  </body>"#,
        body
    )
}

/// The footer for all HTMLs in the website.
pub const FOOTER: &str = r#"
</html>
"#;
