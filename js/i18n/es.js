const es = {
    _meta: {
        name: 'Spanish',
        nativeName: 'Espanol',
        rtl: false
    },
    common: {
        retry: 'Reintentar',
        cancel: 'Cancelar',
        save: 'Guardar',
        dont_save: 'No guardar',
        logout: 'Cerrar sesion',
        close: 'Cerrar',
        minimize: 'Minimizar',
        maximize: 'Maximizar'
    },
    boot: {
        loading_profiles: 'Cargando perfiles...',
        initializing_notifications: 'Inicializando notificaciones...',
        checking_database_health: 'Comprobando base de datos...',
        recovering_database: 'Recuperando base de datos...',
        initializing_secure_storage: 'Inicializando almacenamiento seguro...',
        loading_filesystem: 'Cargando sistema de archivos...',
        loading_installed_apps: 'Cargando aplicaciones instaladas...',
        initializing_cloud_sync: 'Inicializando sincronizacion en la nube...',
        sign_in_continue: 'Inicia sesion para continuar...',
        ready: 'Listo!',
        startup_failed_title: 'Error de inicio',
        startup_failed_preauth: 'Ocurrio un error critico durante el inicio.',
        startup_failed_postauth: 'Ocurrio un error critico al cargar tus datos.'
    },
    desktop: {
        skip_to_desktop: 'Ir al escritorio',
        system_boot: 'Arranque del sistema',
        initializing_system: 'Inicializando sistema...',
        desktop: 'Escritorio de Ephemera',
        desktop_icons: 'Iconos del escritorio',
        workspaces: 'Espacios de trabajo',
        taskbar: 'Barra de tareas',
        start_menu: 'Menu de inicio',
        open_applications: 'Aplicaciones abiertas',
        system_tray: 'Bandeja del sistema',
        notifications: 'Notificaciones',
        current_time: 'Hora actual',
        context_menu: 'Menu contextual',
        search: 'Busqueda',
        search_placeholder: 'Buscar apps, archivos, comandos...',
        search_results: 'Resultados de busqueda',
        windows: 'Ventanas de aplicaciones',
        context: {
            refresh: 'Actualizar',
            app_manager: 'Administrador de apps',
            settings: 'Configuracion',
            open_terminal: 'Abrir terminal'
        },
        open_app: 'Abrir {name}',
        folder_label: 'Carpeta {name}',
        workspace_label: 'Espacio {index}'
    },
    search: {
        start_typing: 'Empieza a escribir para buscar...',
        no_results: 'No se encontraron resultados',
        application: 'Aplicacion'
    },
    categories: {
        system: 'Sistema',
        productivity: 'Productividad',
        utility: 'Utilidades',
        development: 'Desarrollo',
        media: 'Multimedia',
        creative: 'Creativo',
        internet: 'Internet',
        games: 'Juegos',
        user: 'Mis apps'
    },
    settings: {
        language_label: 'Idioma y region',
        language_description: 'Elige el idioma para escritorio y UI principal.',
        language_saved_title: 'Configuracion guardada',
        language_saved_body: 'Idioma actualizado. Reabre apps si algun texto no cambio.'
    },
    command_palette: {
        title: 'Paleta de comandos',
        file_title: 'Paleta de archivos',
        close_hint: 'Esc para cerrar',
        placeholder_action: 'Escribe un comando...',
        placeholder_files: 'Escribe para encontrar archivos...',
        input_aria: 'Entrada de paleta de comandos',
        results_aria: 'Resultados de comandos',
        start_typing: 'Empieza a escribir para buscar...',
        no_matching_commands: 'No hay comandos coincidentes',
        type_to_search_commands: 'Escribe para buscar comandos',
        type_to_search_files: 'Escribe para buscar archivos',
        searching_files: 'Buscando archivos...',
        no_matching_files: 'No hay archivos coincidentes',
        footer_nav_hint: 'Enter para ejecutar - Arriba/Abajo para navegar',
        footer_shortcuts_files_first: 'Ctrl+P archivos - Ctrl+Shift+P acciones',
        footer_shortcuts_actions_first: 'Ctrl+Shift+P acciones - Ctrl+P archivos',
        result_count: '{count} resultado - Enter para ejecutar',
        results_count: '{count} resultados - Enter para ejecutar',
        custom_command_subtitle: 'Comando personalizado'
    }
};

export default es;
