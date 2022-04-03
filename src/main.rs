// eventually I want to self host,
// so all the machinery is here -
// but for now, can use GitHub sites.

use anyhow::Result;
use axum::{http::StatusCode, routing::get_service, Router};
use std::net::SocketAddr;
use tower_http::{services::ServeDir, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use web_server::{build_website, parse_args};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let server = match parse_args() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Error: {}.", e);
            std::process::exit(1);
        }
    };

    build_website("content", "public")?;

    if server {
        tracing_subscriber::registry()
            .with(tracing_subscriber::EnvFilter::new(
                std::env::var("RUST_LOG")
                    .unwrap_or_else(|_| "example_static_file_server=debug,tower_http=debug".into()),
            ))
            .with(tracing_subscriber::fmt::layer())
            .init();

        let app = Router::new()
            .nest(
                "/",
                get_service(ServeDir::new("public")).handle_error(
                    |error: std::io::Error| async move {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            format!("Unhandled internal error: {}", error),
                        )
                    },
                ),
            )
            .layer(TraceLayer::new_for_http());

        let addr = SocketAddr::from(([127, 0, 0, 1], 3000));

        tracing::debug!("listening on {}", addr);

        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await
            .unwrap();
    }

    Ok(())
}
