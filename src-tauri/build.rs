fn main() {
    #[cfg(windows)]
    build_windows_titlebar_bridge();

    tauri_build::build()
}

#[cfg(windows)]
fn build_windows_titlebar_bridge() {
    use std::{env, fs, path::PathBuf};

    let manifest_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("manifest directory"));
    let sdk_dir = manifest_dir.join("vendor/windows-app-sdk");

    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .flag_if_supported("/EHsc")
        .include(sdk_dir.join("include"))
        .file("src/windows_titlebar_bridge.cpp")
        .compile("star_windows_titlebar");

    println!("cargo:rustc-link-search=native={}", sdk_dir.join("lib/x64").display());
    println!("cargo:rustc-link-lib=Microsoft.WindowsAppRuntime.Bootstrap");
    println!("cargo:rustc-link-lib=Comctl32");
    println!("cargo:rerun-if-changed=src/windows_titlebar_bridge.cpp");

    // The unpackaged Windows App SDK bootstrapper must sit beside the executable.
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("build output directory"));
    let profile_dir = out_dir
        .ancestors()
        .nth(3)
        .expect("Cargo profile directory");
    let source = sdk_dir.join("bin/x64/Microsoft.WindowsAppRuntime.Bootstrap.dll");
    let destination = profile_dir.join("Microsoft.WindowsAppRuntime.Bootstrap.dll");
    let already_current = fs::read(&source)
        .ok()
        .zip(fs::read(&destination).ok())
        .is_some_and(|(source_bytes, destination_bytes)| source_bytes == destination_bytes);
    if !already_current {
        fs::copy(source, destination).expect("copy Windows App SDK bootstrapper");
    }
}
