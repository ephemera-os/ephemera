const zh = {
    _meta: {
        name: 'Chinese',
        nativeName: '简体中文',
        rtl: false
    },
    common: {
        retry: '重试',
        cancel: '取消',
        save: '保存',
        dont_save: '不保存',
        logout: '退出登录',
        close: '关闭',
        minimize: '最小化',
        maximize: '最大化'
    },
    boot: {
        loading_profiles: '正在加载配置...',
        initializing_notifications: '正在初始化通知...',
        checking_database_health: '正在检查数据库状态...',
        recovering_database: '正在恢复数据库...',
        initializing_secure_storage: '正在初始化安全存储...',
        loading_filesystem: '正在加载文件系统...',
        loading_installed_apps: '正在加载已安装应用...',
        initializing_cloud_sync: '正在初始化云同步...',
        sign_in_continue: '请登录以继续...',
        ready: '就绪！',
        startup_failed_title: '启动失败',
        startup_failed_preauth: '启动过程中发生严重错误。',
        startup_failed_postauth: '加载数据时发生严重错误。'
    },
    desktop: {
        skip_to_desktop: '跳转到桌面',
        system_boot: '系统启动',
        initializing_system: '正在初始化系统...',
        desktop: 'Ephemera 桌面',
        desktop_icons: '桌面图标',
        workspaces: '工作区',
        taskbar: '任务栏',
        start_menu: '开始菜单',
        open_applications: '已打开应用',
        system_tray: '系统托盘',
        notifications: '通知',
        current_time: '当前时间',
        context_menu: '右键菜单',
        search: '搜索',
        search_placeholder: '搜索应用、文件、命令...',
        search_results: '搜索结果',
        windows: '应用窗口',
        context: {
            refresh: '刷新',
            app_manager: '应用管理器',
            settings: '设置',
            open_terminal: '打开终端'
        },
        open_app: '打开 {name}',
        folder_label: '{name} 文件夹',
        workspace_label: '工作区 {index}'
    },
    search: {
        start_typing: '开始输入以搜索...',
        no_results: '未找到结果',
        application: '应用'
    },
    categories: {
        system: '系统',
        productivity: '效率',
        utility: '工具',
        development: '开发',
        media: '媒体',
        creative: '创作',
        internet: '互联网',
        games: '游戏',
        user: '我的应用'
    },
    settings: {
        language_label: '语言与地区',
        language_description: '选择桌面与核心界面的显示语言。',
        language_saved_title: '设置已保存',
        language_saved_body: '语言已更新。若部分应用未更新，请重新打开。'
    },
    command_palette: {
        title: '命令面板',
        file_title: '文件面板',
        close_hint: '按 Esc 关闭',
        placeholder_action: '输入命令...',
        placeholder_files: '输入以查找文件...',
        input_aria: '命令面板输入',
        results_aria: '命令结果',
        start_typing: '开始输入以搜索...',
        no_matching_commands: '没有匹配的命令',
        type_to_search_commands: '输入以搜索命令',
        type_to_search_files: '输入以搜索文件',
        searching_files: '正在搜索文件...',
        no_matching_files: '没有匹配的文件',
        footer_nav_hint: '回车执行 - 上下键导航',
        footer_shortcuts_files_first: 'Ctrl+P 文件 - Ctrl+Shift+P 动作',
        footer_shortcuts_actions_first: 'Ctrl+Shift+P 动作 - Ctrl+P 文件',
        result_count: '{count} 条结果 - 回车执行',
        results_count: '{count} 条结果 - 回车执行',
        custom_command_subtitle: '自定义命令'
    }
};

export default zh;
