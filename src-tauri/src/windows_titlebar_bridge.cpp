#include <windows.h>
#include <appmodel.h>
#include <commctrl.h>
#include <roapi.h>
#include <algorithm>
#include <vector>
#include <winrt/Microsoft.UI.Windowing.h>

extern "C" HRESULT __stdcall MddBootstrapInitialize2(
    UINT32 majorMinorVersion,
    PCWSTR versionTag,
    PACKAGE_VERSION minVersion,
    INT32 options) noexcept;

namespace {
using GetWindowIdFromWindowFn = HRESULT(__stdcall*)(HWND, winrt::Microsoft::UI::WindowId*);
constexpr UINT_PTR STAR_TITLEBAR_SUBCLASS = 0x53544152;

struct TitlebarState {
    winrt::Microsoft::UI::Windowing::AppWindowTitleBar title_bar;
};

void update_drag_regions(HWND hwnd, TitlebarState const& state) {
    RECT client{};
    if (!GetClientRect(hwnd, &client)) {
        return;
    }

    const int width = client.right - client.left;
    const int center = width / 2;
    const int height = state.title_bar.Height();
    const int content_right = width - state.title_bar.RightInset();
    constexpr int project_end = 160;
    constexpr int tabs_half_width = 58;

    std::vector<winrt::Windows::Graphics::RectInt32> regions;
    const int left_width = center - tabs_half_width - project_end;
    if (left_width > 0) {
        regions.push_back({project_end, 0, left_width, height});
    }
    const int right_start = center + tabs_half_width;
    const int right_width = content_right - right_start;
    if (right_width > 0) {
        regions.push_back({right_start, 0, right_width, height});
    }
    state.title_bar.SetDragRectangles(regions);
}

LRESULT CALLBACK titlebar_subclass(
    HWND hwnd,
    UINT message,
    WPARAM wparam,
    LPARAM lparam,
    UINT_PTR subclass_id,
    DWORD_PTR reference_data) {
    auto* state = reinterpret_cast<TitlebarState*>(reference_data);
    if (state && (message == WM_SIZE || message == WM_DPICHANGED)) {
        update_drag_regions(hwnd, *state);
    }
    if (message == WM_NCDESTROY) {
        RemoveWindowSubclass(hwnd, titlebar_subclass, subclass_id);
        delete state;
    }
    return DefSubclassProc(hwnd, message, wparam, lparam);
}

HRESULT initialize_runtime() noexcept {
    static HRESULT result = []() noexcept {
        PACKAGE_VERSION minimum{};
        // In Windows App SDK 2.x the minor component is intentionally ignored.
        return MddBootstrapInitialize2(0x00020000, nullptr, minimum, 0);
    }();
    return result;
}

HRESULT get_window_id(HWND hwnd, winrt::Microsoft::UI::WindowId& id) noexcept {
    auto module = GetModuleHandleW(L"Microsoft.Internal.FrameworkUdk.dll");
    if (!module) {
        module = LoadLibraryW(L"Microsoft.Internal.FrameworkUdk.dll");
    }
    if (!module) {
        return HRESULT_FROM_WIN32(GetLastError());
    }

    auto function = reinterpret_cast<GetWindowIdFromWindowFn>(
        GetProcAddress(module, "Windowing_GetWindowIdFromWindow"));
    if (!function) {
        return HRESULT_FROM_WIN32(GetLastError());
    }
    return function(hwnd, &id);
}
} // namespace

extern "C" int32_t star_enable_windows_titlebar(
    HWND hwnd,
    int32_t* height,
    int32_t* right_inset) noexcept {
    try {
        HRESULT result = initialize_runtime();
        if (FAILED(result)) {
            return result;
        }

        result = RoInitialize(RO_INIT_SINGLETHREADED);
        if (FAILED(result) && result != RPC_E_CHANGED_MODE) {
            return result;
        }

        winrt::Microsoft::UI::WindowId id{};
        result = get_window_id(hwnd, id);
        if (FAILED(result)) {
            return result;
        }

        if (!winrt::Microsoft::UI::Windowing::AppWindowTitleBar::IsCustomizationSupported()) {
            return HRESULT_FROM_WIN32(ERROR_NOT_SUPPORTED);
        }

        auto app_window = winrt::Microsoft::UI::Windowing::AppWindow::GetFromWindowId(id);
        if (!app_window) {
            return E_FAIL;
        }

        auto title_bar = app_window.TitleBar();
        title_bar.ExtendsContentIntoTitleBar(true);

        auto* state = new TitlebarState{title_bar};
        update_drag_regions(hwnd, *state);
        if (!SetWindowSubclass(
                hwnd,
                titlebar_subclass,
                STAR_TITLEBAR_SUBCLASS,
                reinterpret_cast<DWORD_PTR>(state))) {
            delete state;
            return HRESULT_FROM_WIN32(GetLastError());
        }

        if (height) {
            *height = title_bar.Height();
        }
        if (right_inset) {
            *right_inset = title_bar.RightInset();
        }
        return S_OK;
    } catch (winrt::hresult_error const& error) {
        return error.code();
    } catch (...) {
        return E_FAIL;
    }
}
