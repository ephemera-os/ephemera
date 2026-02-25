const ja = {
    _meta: {
        name: 'Japanese',
        nativeName: '日本語',
        rtl: false
    },
    common: {
        retry: '再試行',
        cancel: 'キャンセル',
        save: '保存',
        dont_save: '保存しない',
        logout: 'ログアウト',
        close: '閉じる',
        minimize: '最小化',
        maximize: '最大化'
    },
    boot: {
        loading_profiles: 'プロファイルを読み込み中...',
        initializing_notifications: '通知を初期化中...',
        checking_database_health: 'データベースを確認中...',
        recovering_database: 'データベースを復旧中...',
        initializing_secure_storage: '安全なストレージを初期化中...',
        loading_filesystem: 'ファイルシステムを読み込み中...',
        loading_installed_apps: 'インストール済みアプリを読み込み中...',
        initializing_cloud_sync: 'クラウド同期を初期化中...',
        sign_in_continue: '続行するにはサインインしてください...',
        ready: '準備完了！',
        startup_failed_title: '起動に失敗しました',
        startup_failed_preauth: '起動中に重大なエラーが発生しました。',
        startup_failed_postauth: 'データ読み込み中に重大なエラーが発生しました。'
    },
    desktop: {
        skip_to_desktop: 'デスクトップへ移動',
        system_boot: 'システム起動',
        initializing_system: 'システムを初期化中...',
        desktop: 'Ephemera デスクトップ',
        desktop_icons: 'デスクトップアイコン',
        workspaces: 'ワークスペース',
        taskbar: 'タスクバー',
        start_menu: 'スタートメニュー',
        open_applications: '開いているアプリ',
        system_tray: 'システムトレイ',
        notifications: '通知',
        current_time: '現在時刻',
        context_menu: 'コンテキストメニュー',
        search: '検索',
        search_placeholder: 'アプリ、ファイル、コマンドを検索...',
        search_results: '検索結果',
        windows: 'アプリケーションウィンドウ',
        context: {
            refresh: '更新',
            app_manager: 'アプリ管理',
            settings: '設定',
            open_terminal: 'ターミナルを開く'
        },
        open_app: '{name} を開く',
        folder_label: '{name} フォルダー',
        workspace_label: 'ワークスペース {index}'
    },
    search: {
        start_typing: '入力して検索...',
        no_results: '結果が見つかりません',
        application: 'アプリケーション'
    },
    categories: {
        system: 'システム',
        productivity: '生産性',
        utility: 'ユーティリティ',
        development: '開発',
        media: 'メディア',
        creative: 'クリエイティブ',
        internet: 'インターネット',
        games: 'ゲーム',
        user: 'マイアプリ'
    },
    settings: {
        language_label: '言語と地域',
        language_description: 'デスクトップと主要UIの表示言語を選択します。',
        language_saved_title: '設定を保存しました',
        language_saved_body: '言語を更新しました。必要に応じてアプリを再度開いてください。'
    },
    command_palette: {
        title: 'コマンドパレット',
        file_title: 'ファイルパレット',
        close_hint: 'Escで閉じる',
        placeholder_action: 'コマンドを入力...',
        placeholder_files: '入力してファイルを検索...',
        input_aria: 'コマンドパレット入力',
        results_aria: 'コマンド結果',
        start_typing: '入力して検索...',
        no_matching_commands: '一致するコマンドがありません',
        type_to_search_commands: '入力してコマンドを検索',
        type_to_search_files: '入力してファイルを検索',
        searching_files: 'ファイルを検索中...',
        no_matching_files: '一致するファイルがありません',
        footer_nav_hint: 'Enterで実行 - 上下キーで移動',
        footer_shortcuts_files_first: 'Ctrl+P ファイル - Ctrl+Shift+P アクション',
        footer_shortcuts_actions_first: 'Ctrl+Shift+P アクション - Ctrl+P ファイル',
        result_count: '{count} 件 - Enterで実行',
        results_count: '{count} 件 - Enterで実行',
        custom_command_subtitle: 'カスタムコマンド'
    }
};

export default ja;
