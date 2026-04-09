/**
 * Language Translation System for Opsicos
 * Handles instant translation of website UI text without page refresh
 */

class LanguageTranslator {
    constructor() {
        this.currentLanguage = 'english';
        this.translations = {};
        this.translatedElements = new Map(); // Store original text and translation keys
        this.initialized = false;
        this.isLoadingPreference = false;
        
        // Define supported languages
        this.supportedLanguages = {
            'english': { name: 'English', code: 'en' },
            'french': { name: 'Français', code: 'fr' },
            'indian': { name: 'हिन्दी (Hindi)', code: 'hi' },
            'urdu': { name: 'اردو (Urdu)', code: 'ur' },
            'nepalese': { name: 'नेपाली (Nepali)', code: 'ne' },
            'spanish': { name: 'Español', code: 'es' },
            'portuguese': { name: 'Português', code: 'pt' },
            'japanese': { name: '日本語 (Japanese)', code: 'ja' },
            'chinese': { name: '中文 (Chinese)', code: 'zh' },
            'italian': { name: 'Italiano', code: 'it' },
            'polish': { name: 'Polski', code: 'pl' },
            'arabic': { name: 'العربية (Arabic)', code: 'ar' },
            'srilankan': { name: 'සිංහල (Sinhala)', code: 'si' },
            'bangla': { name: 'বাংলা (Bangla)', code: 'bn' }
        };
        
        this.initializeTranslations();
    }
    
    initializeTranslations() {
        // Define translations for all UI elements
        this.translations = {
            // Navigation and common elements
            'Dashboard': {
                'french': 'Tableau de bord',
                'indian': 'डैशबोर्ड',
                'urdu': 'ڈیش بورڈ',
                'nepalese': 'ड्यासबोर्ड',
                'spanish': 'Panel de control',
                'portuguese': 'Painel',
                'japanese': 'ダッシュボード',
                'chinese': '仪表板',
                'italian': 'Pannello',
                'polish': 'Panel',
                'arabic': 'لوحة القيادة',
                'srilankan': 'ඩැෂ්බෝර්ඩ්',
                'bangla': 'ড্যাশবোর্ড'
            },
            'My Bots': {
                'french': 'Mes Bots',
                'indian': 'मेरे बॉट',
                'urdu': 'میرے bots',
                'nepalese': 'मेरा bots',
                'spanish': 'Mis Bots',
                'portuguese': 'Meus Bots',
                'japanese': '私のボット',
                'chinese': '我的机器人',
                'italian': 'I miei Bot',
                'polish': 'Moje Boty',
                'arabic': 'بوتاتي',
                'srilankan': 'මගේ බොට්',
                'bangla': 'আমার বট'
            },
            'Knowledge Management': {
                'french': 'Gestion des connaissances',
                'indian': 'ज्ञान प्रबंधन',
                'urdu': 'دانائی کا انتظام',
                'nepalese': 'ज्ञान व्यवस्थापन',
                'spanish': 'Gestión del conocimiento',
                'portuguese': 'Gestão do conhecimento',
                'japanese': 'ナレッジ管理',
                'chinese': '知识管理',
                'italian': 'Gestione della conoscenza',
                'polish': 'Zarządzanie wiedzą',
                'arabic': 'إدارة المعرفة',
                'srilankan': 'දැනුම කළමනාකරණය',
                'bangla': 'জ্ঞান ব্যবস্থাপনা'
            },
            'Stored Knowledge': {
                'french': 'Connaissances stockées',
                'indian': 'संग्रहीत ज्ञान',
                'urdu': 'محفوظ شدہ علم',
                'nepalese': 'संग्रहित ज्ञान',
                'spanish': 'Conocimiento almacenado',
                'portuguese': 'Conhecimento armazenado',
                'japanese': '保存されたナレッジ',
                'chinese': '存储的知识',
                'italian': 'Conoscenza memorizzata',
                'polish': 'Zapisana wiedza',
                'arabic': 'المعرفة المخزنة',
                'srilankan': 'ගබඩා කළ දැනුම',
                'bangla': 'সংরক্ষিত জ্ঞান'
            },
            '🎭 Bot Behavior': {
                'french': '🎭 Comportement du Bot',
                'indian': '🎭 बॉट व्यवहार',
                'urdu': '🎭 بہاؤ',
                'nepalese': '🎭 बोट व्यवहार',
                'spanish': '🎭 Comportamiento del Bot',
                'portuguese': '🎭 Comportamento do Bot',
                'japanese': '🎭 ボットの振る舞い',
                'chinese': '🎭 机器人行为',
                'italian': '🎭 Comportamento del Bot',
                'polish': '🎭 Zachowanie Bota',
                'arabic': '🎭 سلوك البوت',
                'srilankan': '🎭 බොට් හැසිරීම',
                'bangla': '🎭 বট আচরণ'
            },
            '📊 Bot Uptime Status': {
                'french': '📊 État de disponibilité du Bot',
                'indian': '📊 बॉट अपटाइम स्थिति',
                'urdu': '📊 بٹ اپ ٹائم کی صورت',
                'nepalese': '📊 बोट अपटाइम स्थिति',
                'spanish': '📊 Estado de tiempo de actividad del Bot',
                'portuguese': '📊 Status de tempo de atividade do Bot',
                'japanese': '📊 ボットの稼働時間ステータス',
                'chinese': '📊 机器人运行时间状态',
                'italian': '📊 Stato di uptime del Bot',
                'polish': '📊 Status czasu pracy Bota',
                'arabic': '📊 حالة تشغيل البوت',
                'srilankan': '📊 බොට් අප්ටයිම් තත්ත්වය',
                'bangla': '📊 বট আপটাইম স্ট্যাটাস'
            },
            '🔧 Features': {
                'french': '🔧 Fonctionnalités',
                'indian': '🔧 विशेषताएं',
                'urdu': '🔧 خصوصیات',
                'nepalese': '🔧 विशेषताहरू',
                'spanish': '🔧 Características',
                'portuguese': '🔧 Recursos',
                'japanese': '🔧 機能',
                'chinese': '🔧 功能',
                'italian': '🔧 Funzionalità',
                'polish': '🔧 Funkcje',
                'arabic': '🔧 الميزات',
                'srilankan': '🔧 විශේෂාංග',
                'bangla': '🔧 বৈশিষ্ট্য'
            },
            '🎮 Playground': {
                'french': '🎮 Aire de jeu',
                'indian': '🎮 खेल का मैदान',
                'urdu': '🎮 کھیل کا میدان',
                'nepalese': '🎮 खेल मैदान',
                'spanish': '🎮 Zona de juegos',
                'portuguese': '🎮 Playground',
                'japanese': '🎮 プレイグラウンド',
                'chinese': '🎮 游乐场',
                'italian': '🎮 Area di gioco',
                'polish': '🎮 Plac zabaw',
                'arabic': '🎮 ملعب',
                'srilankan': '🎮 ක්රීඩාංගනය',
                'bangla': '🎮 খেলার মাঠ'
            },
            '⚙️ Settings': {
                'french': '⚙️ Paramètres',
                'indian': '⚙️ सेटिंग्स',
                'urdu': '⚙️ ترتیبات',
                'nepalese': '⚙️ सेटिङहरू',
                'spanish': '⚙️ Configuración',
                'portuguese': '⚙️ Configurações',
                'japanese': '⚙️ 設定',
                'chinese': '⚙️ 设置',
                'italian': '⚙️ Impostazioni',
                'polish': '⚙️ Ustawienia',
                'arabic': '⚙️ الإعدادات',
                'srilankan': '⚙️ සැකසුම්',
                'bangla': '⚙️ সেটিংস'
            },
            '📋 Terms of Service': {
                'french': '📋 Conditions d\'utilisation',
                'indian': '📋 सेवा की शर्तें',
                'urdu': '📋 سروس کی شرائط',
                'nepalese': '📋 सेवा का शर्त',
                'spanish': '📋 Términos de servicio',
                'portuguese': '📋 Termos de serviço',
                'japanese': '📋 利用規約',
                'chinese': '📋 服务条款',
                'italian': '📋 Termini di servizio',
                'polish': '📋 Regulamin usługi',
                'arabic': '📋 شروط الخدمة',
                'srilankan': '📋 සේවා විධිවිධාන',
                'bangla': '📋 সেবা শর্তাবলী'
            },
            '🔒 Privacy Policy': {
                'french': '🔒 Politique de confidentialité',
                'indian': '🔒 गोपनीयता नीति',
                'urdu': '🔒 رازداری کی پالیسی',
                'nepalese': '🔒 गोपनीयता नीति',
                'spanish': '🔒 Política de privacidad',
                'portuguese': '🔒 Política de privacidade',
                'japanese': '🔒 プライバシーポリシー',
                'chinese': '🔒 隐私政策',
                'italian': '🔒 Informativa sulla privacy',
                'polish': '🔒 Polityka prywatności',
                'arabic': '🔒 سياسة الخصوصية',
                'srilankan': '🔒 රහස්යතා ප්රතිපත්තිය',
                'bangla': '🔒 গোপনীয়তা নীতি'
            },
            'Logout': {
                'french': 'Déconnexion',
                'indian': 'लॉगआउट',
                'urdu': 'لاگ آؤٹ',
                'nepalese': 'लगआउट',
                'spanish': 'Cerrar sesión',
                'portuguese': 'Sair',
                'japanese': 'ログアウト',
                'chinese': '登出',
                'italian': 'Disconnessione',
                'polish': 'Wyloguj',
                'arabic': 'تسجيل الخروج',
                'srilankan': 'ලොග්අවුට්',
                'bangla': 'লগআউট'
            },
            'Loading...': {
                'french': 'Chargement...',
                'indian': 'लोड हो रहा है...',
                'urdu': 'لوڈ ہو رہا ہے...',
                'nepalese': 'लोड हुँदै...',
                'spanish': 'Cargando...',
                'portuguese': 'Carregando...',
                'japanese': '読み込み中...',
                'chinese': '加载中...',
                'italian': 'Caricamento...',
                'polish': 'Ładowanie...',
                'arabic': 'جاري التحميل...',
                'srilankan': 'පූරණය වෙමින්...',
                'bangla': 'লোড হচ্ছে...'
            },
            
            // Additional settings page elements
            'Get real-time notifications about your bot status changes directly in your Discord server. Configure a webhook URL below to receive automated alerts when your bots go online, offline, or encounter issues.': {
                'french': 'Recevez des notifications en temps réel sur les changements de statut de vos bots directement dans votre serveur Discord. Configurez une URL de webhook ci-dessous pour recevoir des alertes automatisées lorsque vos bots se connectent, se déconnectent ou rencontrent des problèmes.',
                'indian': 'अपने बॉट स्थिति परिवर्तनों के बारे में निजी अधिसूचनाएं प्राप्त करें। जब आपके बॉट ऑनलाइन, ऑफलाइन होते हैं या समस्याओं का सामना करते हैं, तो स्वचालित अलर्ट प्राप्त करने के लिए नीचे एक वेबहुक URL कॉन्फ़िगर करें।',
                'urdu': 'اپنے بٹ کی حیثیت میں تبدیلیوں کے بارے میں فوری اطلاعات حاصل کریں۔ جب آپ کے بٹ آن لائن، آف لائن ہوتے ہیں یا مشکلات کا سامنا کرتے ہیں، تو خودکار الرٹس حاصل کرنے کے لیے نیچے ایک ویب ہک URL پر تشکیل دیں۔',
                'nepalese': 'तपाईंको बोट स्ट्याटस परिवर्तनको बारेमा रियल-टाइम सूचनाहरू प्राप्त गर्नुहोस्। तपाईंका बोटहरू अनलाइन, अफलाइन हुँदा वा समस्याहरूको सामना गर्दा स्वचालित सतर्कताहरू प्राप्त गर्न तल एउटा वेबहुक URL कन्फिगर गर्नुहोस्।',
                'spanish': 'Recibe notificaciones en tiempo real sobre los cambios de estado de tus bots directamente en tu servidor de Discord. Configura una URL de webhook a continuación para recibir alertas automáticas cuando tus bots se conecten, se desconecten o encuentren problemas.',
                'portuguese': 'Receba notificações em tempo real sobre as mudanças de status dos seus bots diretamente no seu servidor Discord. Configure uma URL de webhook abaixo para receber alertas automatizados quando seus bots ficarem online, offline ou encontrarem problemas.',
                'japanese': 'ボットのステータス変更に関するリアルタイム通知をDiscordサーバーで直接受け取ります。ボットがオンライン、オフライン、または問題に遭遇したときに自動アラートを受け取るために、以下にWebhook URLを設定してください。',
                'chinese': '在您的Discord服务器中直接获取有关机器人状态更改的实时通知。配置下面的Webhook URL，以便在您的机器人上线、下线或遇到问题时接收自动警报。',
                'italian': 'Ricevi notifiche in tempo reale sui cambiamenti di stato dei tuoi bot direttamente nel tuo server Discord. Configura un URL webhook qui sotto per ricevere avvisi automatici quando i tuoi bot vanno online, offline o incontrano problemi.',
                'polish': 'Otrzymuj powiadomienia w czasie rzeczywistym o zmianach statusu swoich botów bezpośrednio na swoim serwerze Discord. Skonfiguruj adres URL webhook poniżej, aby otrzymywać automatyczne alerty, gdy Twoje boty przejdą online, offline lub napotkają problemy.',
                'arabic': 'احصل على إشعارات في الوقت الفعلي حول تغييرات حالة البوت الخاصة بك مباشرة في خادم Discord الخاص بك. قم بتكوين عنوان URL ل webhook أدناه لتلقي تنبيهات تلقائية عندما تصبح البوتات الخاصة بك متصلة أو غير متصلة أو تواجه مشكلات.',
                'srilankan': 'ඔබගේ බොට් තත්ත්ව වෙනස්කම් පිළිබඳව ඔබගේ Discord සර්වරයේ සෘජුවම නියත වේලාවේ දැනුම්දීම් ලබා ගන්න. ඔබගේ බොට් මාර්ගගත වූ, මාර්ගගත නොවූ හෝ ගැටළුවලට මුහුණ දෙන විට ස්වයංක්රීය ඇලට් ලබා ගැනීමට පහත වෙබ්හුක් URL එක වින්යාස කරන්න.',
                'bangla': 'আপনার বট স্ট্যাটাস পরিবর্তন সম্পর্কে আপনার ডিসকর্ড সার্ভারে সরাসরি রিয়েল-টাইম বিজ্ঞপ্তি পান। আপনার বটগুলি অনলাইন, অফলাইন হয় বা সমস্যার সম্মুখীন হলে স্বয়ংক্রিয় সতর্কতা পেতে নীচে একটি ওয়েবহুক URL কনফিগার করুন।'
            },
            'How to Create a Discord Webhook:': {
                'french': 'Comment créer un webhook Discord :',
                'indian': 'डिस्कॉर्ड वेबहुक कैसे बनाएं:',
                'urdu': 'ڈسکورڈ ویب ہوک کیسے بنائیں:',
                'nepalese': 'डिस्कोर्ड वेबहुक कसरी बनाउने:',
                'spanish': 'Cómo crear un webhook de Discord:',
                'portuguese': 'Como criar um webhook do Discord:',
                'japanese': 'Discord Webhookの作成方法:',
                'chinese': '如何创建Discord Webhook：',
                'italian': 'Come creare un webhook Discord:',
                'polish': 'Jak utworzyć webhook Discord:',
                'arabic': 'كيفية إنشاء ويب هوك Discord:',
                'srilankan': 'Discord වෙබ්හුක් එකක් කොහොමද හදන්නේ:',
                'bangla': 'কিভাবে একটি ডিসকর্ড ওয়েবহুক তৈরি করবেন:'
            },
            '🌐 Language Settings': {
                'french': '🌐 Paramètres de langue',
                'indian': '🌐 भाषा सेटिंग्स',
                'urdu': '🌐 زبان کی ترتیبات',
                'nepalese': '🌐 भाषा सेटिङहरू',
                'spanish': '🌐 Configuración de idioma',
                'portuguese': '🌐 Configurações de idioma',
                'japanese': '🌐 言語設定',
                'chinese': '🌐 语言设置',
                'italian': '🌐 Impostazioni lingua',
                'polish': '🌐 Ustawienia języka',
                'arabic': '🌐 إعدادات اللغة',
                'srilankan': '🌐 භාෂා සැකසුම්',
                'bangla': '🌐 ভাষা সেটিংস'
            },
            'Select your preferred language for the website interface. This will instantly translate all text on the page without requiring a refresh.': {
                'french': 'Sélectionnez votre langue préférée pour l\'interface du site web. Cela traduira instantanément tout le texte de la page sans nécessiter d\'actualisation.',
                'indian': 'वेबसाइट इंटरफ़ेस के लिए अपनी पसंदीदा भाषा चुनें। यह ताज़ा बनाए बिना पृष्ठ पर सभी टेक्स्ट का तुरंत अनुवाद करेगा।',
                'urdu': 'ویب سائٹ انٹرفیس کے لیے اپنی پسندیدہ زبان منتخب کریں۔ یہ ریفریش کے بغیر صفحے پر تمام متن کا فوری ترجمہ کرے گا۔',
                'nepalese': 'वेबसाइट इन्टरफेसको लागि तपाईंको प्राथमिकता भाषा छनोट गर्नुहोस्। यसले रिफ्रेस गर्नु नपरी पृष्ठमा सबै पाठलाई तुरुन्त अनुवाद गर्नेछ।',
                'spanish': 'Selecciona tu idioma preferido para la interfaz del sitio web. Esto traducirá instantáneamente todo el texto en la página sin necesidad de actualizar.',
                'portuguese': 'Selecione seu idioma preferido para a interface do site. Isso traduzirá instantaneamente todo o texto na página sem precisar atualizar.',
                'japanese': 'ウェブサイトインターフェースの言語を選択してください。これにより、更新なしでページ上のすべてのテキストが即座に翻訳されます。',
                'chinese': '选择网站界面的首选语言。这将即时翻译页面上的所有文本，无需刷新。',
                'italian': 'Seleziona la lingua preferita per l\'interfaccia del sito web. Questo tradurrà istantaneamente tutto il testo sulla pagina senza bisogno di aggiornare.',
                'polish': 'Wybierz preferowany język interfejsu witryny. Spowoduje to natychmiastowe tłumaczenie całego tekstu na stronie bez konieczności odświeżania.',
                'arabic': 'اختر لغتك المفضلة لواجهة الموقع. سيؤدي هذا إلى ترجمة جميع النصوص في الصفحة فورًا دون الحاجة إلى تحديث.',
                'srilankan': 'වෙබ් අඩවි අතුල්ලය සඳහා ඔබගේ කැමති භාෂාව තෝරන්න. මෙය නැවතුණුවකින් තොරා පිටුවේ සියළු වචන ක්ෂණිකව පරිවර්තනය කරනු ඇත.',
                'bangla': 'ওয়েবসাইট ইন্টারফেসের জন্য আপনার পছন্দের ভাষা নির্বাচন করুন। এটি রিফ্রেশের প্রয়োজন ছাড়াই পৃষ্ঠার সমস্ত টেক্সট তাৎক্ষণিকভাবে অনুবাদ করবে।'
            },
            'Website Language': {
                'french': 'Langue du site web',
                'indian': 'वेबसाइट भाषा',
                'urdu': 'ویب سائٹ زبان',
                'nepalese': 'वेबसाइट भाषा',
                'spanish': 'Idioma del sitio web',
                'portuguese': 'Idioma do site',
                'japanese': 'ウェブサイトの言語',
                'chinese': '网站语言',
                'italian': 'Lingua del sito',
                'polish': 'Język witryny',
                'arabic': 'لغة الموقع',
                'srilankan': 'වෙබ් අඩවියේ භාෂාව',
                'bangla': 'ওয়েবসাইট ভাষা'
            },
            'Choose your preferred language for the Opsicos interface. This setting only affects the website text, not your bot responses.': {
                'french': 'Choisissez votre langue préférée pour l\'interface Opsicos. Ce paramètre n\'affecte que le texte du site Web, pas les réponses de votre bot.',
                'indian': 'ओप्सिकोस इंटरफ़ेस के लिए अपनी पसंदीदा भाषा चुनें। यह सेटिंग केवल वेबसाइट टेक्स्ट को प्रभावित करती है, आपके बॉट प्रतिक्रियाओं को नहीं।',
                'urdu': 'اپسicos انٹرفیس کے لیے اپنی پسندیدہ زبان منتخب کریں۔ یہ ترتیب صرف ویب سائٹ ٹیکسٹ کو متاثر کرتی ہے، آپ کے بٹ جوابات کو نہیں۔',
                'nepalese': 'Opsicos इन्टरफेसको लागि तपाईंको प्राथमिकता भाषा छनोट गर्नुहोस्। यो सेटिङले केवल वेबसाइट पाठलाई असर गर्छ, तपाईंको बोट प्रतिक्रियाहरूलाई होइन।',
                'spanish': 'Elige tu idioma preferido para la interfaz de Opsicos. Esta configuración solo afecta el texto del sitio web, no las respuestas de tu bot.',
                'portuguese': 'Escolha seu idioma preferido para a interface Opsicos. Esta configuração afeta apenas o texto do site, não as respostas do seu bot.',
                'japanese': 'Opsicosインターフェースの言語を選択してください。この設定は、ウェブサイトのテキストにのみ影響し、ボットの応答には影響しません。',
                'chinese': '选择Opsicos界面的首选语言。此设置仅影响网站文本，不影响您的机器人回复。',
                'italian': 'Scegli la lingua preferita per l\'interfaccia Opsicos. Questa impostazione influisce solo sul testo del sito web, non sulle risposte del tuo bot.',
                'polish': 'Wybierz preferowany język interfejsu Opsicos. To ustawienie wpływa tylko na tekst witryny, a nie na odpowiedzi bota.',
                'arabic': 'اختر لغتك المفضلة لواجهة Opsicos. هذا الإعداد يؤثر فقط على نص الموقع، وليس على ردود البوت الخاصة بك.',
                'srilankan': 'Opsicos අතුල්ලය සඳහා ඔබගේ කැමති භාෂාව තෝරන්න. මෙම සැකසුම වෙබ් අඩවි පෙළ පමණක් පමණක් බලපා කරයි, ඔබගේ බොට් ප්රතිචාර නොවේ.',
                'bangla': 'অপসিকোস ইন্টারফেসের জন্য আপনার পছন্দের ভাষা নির্বাচন করুন। এই সেটিংটি কেবল ওয়েবসাইট টেক্সটকে প্রভাবিত করে, আপনার বটের প্রতিক্রিয়া নয়।'
            },
            'Save Language': {
                'french': 'Enregistrer la langue',
                'indian': 'भाषा सहेजें',
                'urdu': 'زبان محفوظ کریں',
                'nepalese': 'भाषा बचत गर्नुहोस्',
                'spanish': 'Guardar idioma',
                'portuguese': 'Salvar idioma',
                'japanese': '言語を保存',
                'chinese': '保存语言',
                'italian': 'Salva lingua',
                'polish': 'Zapisz język',
                'arabic': 'حفظ اللغة',
                'srilankan': 'භාෂාව සුරකින්න',
                'bangla': 'ভাষা সংরক্ষণ করুন'
            },
            // Settings page specific
            '🔔 Bot Status Webhook Alerts': {
                'french': '🔔 Alertes Webhook de Statut de Bot',
                'indian': '🔔 बॉट स्थिति वेबहुक अलर्ट',
                'urdu': '🔔 بٹ اسٹیٹس ویب ہک الرٹس',
                'nepalese': '🔔 बोट स्थिति वेबहुक अलर्टहरू',
                'spanish': '🔔 Alertas de Webhook de Estado de Bot',
                'portuguese': '🔔 Alertas de Webhook de Status do Bot',
                'japanese': '🔔 ボットステータスWebhookアラート',
                'chinese': '🔔 机器人状态Webhook警报',
                'italian': '🔔 Avvisi Webhook Stato Bot',
                'polish': '🔔 Alerty Webhook Statusu Botów',
                'arabic': '🔔 تنبيهات ويب هوك حالة البوت',
                'srilankan': '🔔 බොට් තත්ත්වය වෙබ්හුක් ඇලට්',
                'bangla': '🔔 বট স্ট্যাটাস ওয়েবহুক সতর্কতা'
            },
            'Webhook Status:': {
                'french': 'État du Webhook :',
                'indian': 'वेबहुक स्थिति:',
                'urdu': 'ویب ہک کی صورت:',
                'nepalese': 'वेबहुक स्थिति:',
                'spanish': 'Estado del Webhook:',
                'portuguese': 'Status do Webhook:',
                'japanese': 'Webhookの状態:',
                'chinese': 'Webhook状态：',
                'italian': 'Stato del Webhook:',
                'polish': 'Status Webhooka:',
                'arabic': 'حالة الويب هوك:',
                'srilankan': 'වෙබ්හුක් තත්ත්වය:',
                'bangla': 'ওয়েবহুক স্ট্যাটাস:'
            },
            'Not configured': {
                'french': 'Non configuré',
                'indian': 'कॉन्फ़िगर नहीं किया गया',
                'urdu': 'ترتیب نہیں دی گئی',
                'nepalese': 'कन्फिगर गरिएको छैन',
                'spanish': 'No configurado',
                'portuguese': 'Não configurado',
                'japanese': '設定されていません',
                'chinese': '未配置',
                'italian': 'Non configurato',
                'polish': 'Nie skonfigurowano',
                'arabic': 'لم يتم التكوين',
                'srilankan': 'වින්යාස කර නැත',
                'bangla': 'কনফিগার করা হয়নি'
            },
            'Webhook configured and active': {
                'french': 'Webhook configuré et actif',
                'indian': 'वेबहुक कॉन्फ़िगर किया गया और सक्रिय',
                'urdu': 'ویب ہک ترتیب دی گئی اور فعال ہے',
                'nepalese': 'वेबहुक कन्फिगर गरिएको छ र सक्रिय छ',
                'spanish': 'Webhook configurado y activo',
                'portuguese': 'Webhook configurado e ativo',
                'japanese': 'Webhookが設定され、アクティブです',
                'chinese': 'Webhook已配置并激活',
                'italian': 'Webhook configurato e attivo',
                'polish': 'Webhook skonfigurowany i aktywny',
                'arabic': 'تم تكوين الويب هوك وتنشيطه',
                'srilankan': 'වෙබ්හුක් වින්යාස කර සක්රිය කර ඇත',
                'bangla': 'ওয়েবহুক কনফিগার করা হয়েছে এবং সক্রিয়'
            },
            'Discord Webhook URL': {
                'french': 'URL Webhook Discord',
                'indian': 'डिस्कॉर्ड वेबहुक URL',
                'urdu': 'ڈسکورڈ ویب ہک URL',
                'nepalese': 'डिस्कोर्ड वेबहुक URL',
                'spanish': 'URL Webhook de Discord',
                'portuguese': 'URL Webhook do Discord',
                'japanese': 'Discord Webhook URL',
                'chinese': 'Discord Webhook URL',
                'italian': 'URL Webhook Discord',
                'polish': 'URL Webhook Discord',
                'arabic': 'رابط ويب هوك Discord',
                'srilankan': 'Discord වෙබ්හුක් URL',
                'bangla': 'ডিসকর্ড ওয়েবহুক URL'
            },
            'Save Webhook': {
                'french': 'Enregistrer le Webhook',
                'indian': 'वेबहुक सहेजें',
                'urdu': 'ویب ہک محفوظ کریں',
                'nepalese': 'वेबहुक बचत गर्नुहोस्',
                'spanish': 'Guardar Webhook',
                'portuguese': 'Salvar Webhook',
                'japanese': 'Webhookを保存',
                'chinese': '保存Webhook',
                'italian': 'Salva Webhook',
                'polish': 'Zapisz Webhook',
                'arabic': 'حفظ الويب هوك',
                'srilankan': 'වෙබ්හුක් සුරකින්න',
                'bangla': 'ওয়েবহুক সংরক্ষণ করুন'
            },
            'Test Webhook': {
                'french': 'Tester le Webhook',
                'indian': 'वेबहुक परीक्षण करें',
                'urdu': 'ویب ہک ٹیسٹ کریں',
                'nepalese': 'वेबहुक परीक्षण गर्नुहोस्',
                'spanish': 'Probar Webhook',
                'portuguese': 'Testar Webhook',
                'japanese': 'Webhookをテスト',
                'chinese': '测试Webhook',
                'italian': 'Testa Webhook',
                'polish': 'Testuj Webhook',
                'arabic': 'اختبار الويب هوك',
                'srilankan': 'වෙබ්හුක් පරීක්ෂා කරන්න',
                'bangla': 'ওয়েবহুক পরীক্ষা করুন'
            },
            'Remove Webhook': {
                'french': 'Supprimer le Webhook',
                'indian': 'वेबहुक हटाएं',
                'urdu': 'ویب ہک ہٹائیں',
                'nepalese': 'वेबहुक हटाउनुहोस्',
                'spanish': 'Eliminar Webhook',
                'portuguese': 'Remover Webhook',
                'japanese': 'Webhookを削除',
                'chinese': '删除Webhook',
                'italian': 'Rimuovi Webhook',
                'polish': 'Usuń Webhook',
                'arabic': 'إزالة الويب هوك',
                'srilankan': 'වෙබ්හුක් ඉවත් කරන්න',
                'bangla': 'ওয়েবহুক সরান'
            },
            'Alert Events:': {
                'french': 'Événements d\'alerte :',
                'indian': 'अलर्ट इवेंट्स:',
                'urdu': 'الرٹ ایونٹس:',
                'nepalese': 'सतर्कता घटनाहरू:',
                'spanish': 'Eventos de alerta:',
                'portuguese': 'Eventos de alerta:',
                'japanese': 'アラートイベント：',
                'chinese': '警报事件：',
                'italian': 'Eventi di avviso:',
                'polish': 'Zdarzenia alertów:',
                'arabic': 'أحداث التنبيه:',
                'srilankan': 'ඇලට් සිදුවීම්:',
                'bangla': 'সতর্কতা ইভেন্ট:'
            },
            '🟢 Bot Started': {
                'french': '🟢 Bot démarré',
                'indian': '🟢 बॉट शुरू हुआ',
                'urdu': '🟢 بٹ شروع ہوا',
                'nepalese': '🟢 बोट सुरु भयो',
                'spanish': '🟢 Bot iniciado',
                'portuguese': '🟢 Bot iniciado',
                'japanese': '🟢 ボットが開始されました',
                'chinese': '🟢 机器人已启动',
                'italian': '🟢 Bot avviato',
                'polish': '🟢 Bot uruchomiony',
                'arabic': '🟢 تم بدء البوت',
                'srilankan': '🟢 බොට් ආරම්භ කරන ලදී',
                'bangla': '🟢 বট শুরু হয়েছে'
            },
            'When you manually start a bot': {
                'french': 'Lorsque vous démarrez manuellement un bot',
                'indian': 'जब आप मैन्युअली एक बॉट शुरू करते हैं',
                'urdu': 'جب آپ دستی طور پر ایک بٹ شروع کرتے ہیں',
                'nepalese': 'जब तपाईं म्यानुअली एउटा बोट सुरु गर्नुहुन्छ',
                'spanish': 'Cuando inicias manualmente un bot',
                'portuguese': 'Quando você inicia manualmente um bot',
                'japanese': '手動でボットを開始したとき',
                'chinese': '当您手动启动机器人时',
                'italian': 'Quando avvii manualmente un bot',
                'polish': 'Gdy ręcznie uruchamiasz bota',
                'arabic': 'عندما تبدأ البوت يدوياً',
                'srilankan': 'ඔබ අතින් බොට් එකක් ආරම්භ කරන විට',
                'bangla': 'যখন আপনি ম্যানুয়ালি একটি বট শুরু করেন'
            },
            '🔴 Bot Stopped': {
                'french': '🔴 Bot arrêté',
                'indian': '🔴 बॉट बंद हो गया',
                'urdu': '🔴 بٹ بند ہو گیا',
                'nepalese': '🔴 बोट रोकियो',
                'spanish': '🔴 Bot detenido',
                'portuguese': '🔴 Bot parado',
                'japanese': '🔴 ボットが停止されました',
                'chinese': '🔴 机器人已停止',
                'italian': '🔴 Bot fermato',
                'polish': '🔴 Bot zatrzymany',
                'arabic': '🔴 تم إيقاف البوت',
                'srilankan': '🔴 බොට් නවතා ඇත',
                'bangla': '🔴 বট বন্ধ হয়েছে'
            },
            'When you manually stop a bot': {
                'french': 'Lorsque vous arrêtez manuellement un bot',
                'indian': 'जब आप मैन्युअली एक बॉट बंद करते हैं',
                'urdu': 'جب آپ دستی طور پر ایک بٹ بند کرتے ہیں',
                'nepalese': 'जब तपाईं म्यानुअली एउटा बोट रोक्नुहुन्छ',
                'spanish': 'Cuando detienes manualmente un bot',
                'portuguese': 'Quando você para manualmente um bot',
                'japanese': '手動でボットを停止したとき',
                'chinese': '当您手动停止机器人时',
                'italian': 'Quando fermi manualmente un bot',
                'polish': 'Gdy ręcznie zatrzymujesz bota',
                'arabic': 'عندما توقف البوت يدوياً',
                'srilankan': 'ඔබ අතින් බොට් එකක් නවත්වන විට',
                'bangla': 'যখন আপনি ম্যানুয়ালি একটি বট বন্ধ করেন'
            },
            '✅ Bot Online': {
                'french': '✅ Bot en ligne',
                'indian': '✅ बॉट ऑनलाइन',
                'urdu': '✅ بٹ آن لائن',
                'nepalese': '✅ बोट अनलाइन',
                'spanish': '✅ Bot en línea',
                'portuguese': '✅ Bot online',
                'japanese': '✅ ボットがオンライン',
                'chinese': '✅ 机器人在线',
                'italian': '✅ Bot online',
                'polish': '✅ Bot online',
                'arabic': '✅ البوت متصل',
                'srilankan': '✅ බොට් මාර්ගගත',
                'bangla': '✅ বট অনলাইন'
            },
            'When bot successfully connects to Discord': {
                'french': 'Lorsque le bot se connecte avec succès à Discord',
                'indian': 'जब बॉट सफलतापूर्वक Discord से कनेक्ट होता है',
                'urdu': 'جب بٹ کامیابی سے Discord سے جڑتا ہے',
                'nepalese': 'जब बोट सफलतापूर्वक Discord सँग जोडिन्छ',
                'spanish': 'Cuando el bot se conecta exitosamente a Discord',
                'portuguese': 'Quando o bot se conecta com sucesso ao Discord',
                'japanese': 'ボットがDiscordに正常に接続したとき',
                'chinese': '当机器人成功连接到Discord时',
                'italian': 'Quando il bot si connette con successo a Discord',
                'polish': 'Gdy bot pomyślnie łączy się z Discord',
                'arabic': 'عندما يتصل البوت بنجاح بـ Discord',
                'srilankan': 'බොට් Discord සමඟ සාර්ථකව සම්බන්ධ වන විට',
                'bangla': 'যখন বট সফলভাবে ডিসকর্ডের সাথে সংযুক্ত হয়'
            },
            '⚠️ Bot Offline': {
                'french': '⚠️ Bot hors ligne',
                'indian': '⚠️ बॉट ऑफलाइन',
                'urdu': '⚠️ بٹ آف لائن',
                'nepalese': '⚠️ बोट अफलाइन',
                'spanish': '⚠️ Bot desconectado',
                'portuguese': '⚠️ Bot offline',
                'japanese': '⚠️ ボットがオフライン',
                'chinese': '⚠️ 机器人离线',
                'italian': '⚠️ Bot offline',
                'polish': '⚠️ Bot offline',
                'arabic': '⚠️ البوت غير متصل',
                'srilankan': '⚠️ බොට් මාර්ගගත නොවේ',
                'bangla': '⚠️ বট অফলাইন'
            },
            'When bot disconnects or goes offline': {
                'french': 'Lorsque le bot se déconnecte ou passe hors ligne',
                'indian': 'जब बॉट डिस्कनेक्ट होता है या ऑफलाइन हो जाता है',
                'urdu': 'جب بٹ ڈسکنیکٹ ہوتا ہے یا آف لائن ہو جاتا ہے',
                'nepalese': 'जब बोट डिस्कनेक्ट हुन्छ वा अफलाइन हुन्छ',
                'spanish': 'Cuando el bot se desconecta o se queda sin conexión',
                'portuguese': 'Quando o bot se desconecta ou fica offline',
                'japanese': 'ボットが切断またはオフラインになったとき',
                'chinese': '当机器人断开连接或离线时',
                'italian': 'Quando il bot si disconnette o va offline',
                'polish': 'Gdy bot rozłącza się lub idzie offline',
                'arabic': 'عندما ينقطع الاتصال بالبوت أو يصبح غير متصل',
                'srilankan': 'බොට් සම්බන්ධය බිඳ වැටුන විට හෝ මාර්ගගත නොවන විට',
                'bangla': 'যখন বট সংযোগ বিচ্ছিন্ন হয় বা অফলাইন যায়'
            },
            '❌ Bot Error': {
                'french': '❌ Erreur de bot',
                'indian': '❌ बॉट त्रुटि',
                'urdu': '❌ بٹ خرابی',
                'nepalese': '❌ बोट त्रुटि',
                'spanish': '❌ Error de bot',
                'portuguese': '❌ Erro de bot',
                'japanese': '❌ ボットエラー',
                'chinese': '❌ 机器人错误',
                'italian': '❌ Errore del bot',
                'polish': '❌ Błąd bota',
                'arabic': '❌ خطأ في البوت',
                'srilankan': '❌ බොට් දෝෂයක්',
                'bangla': '❌ বট ত্রুটি'
            },
            'When bot encounters an error or crashes': {
                'french': 'Lorsque le bot rencontre une erreur ou plante',
                'indian': 'जब बॉट कोई त्रुटि का सामना करता है या क्रैश हो जाता है',
                'urdu': 'جب بٹ کوئی خرابی کا سامنا کرتا ہے یا کرینش ہو جاتا ہے',
                'nepalese': 'जब बोट कुनै त्रुटिको सामना गर्छ वा क्र्यास हुन्छ',
                'spanish': 'Cuando el bot encuentra un error o falla',
                'portuguese': 'Quando o bot encontra um erro ou trava',
                'japanese': 'ボットがエラーに遭遇したとき、またはクラッシュしたとき',
                'chinese': '当机器人遇到错误或崩溃时',
                'italian': 'Quando il bot incontra un errore o si blocca',
                'polish': 'Gdy bot napotyka błąd lub się zawiesza',
                'arabic': 'عندما يواجه البوت خطأ أو يتعطل',
                'srilankan': 'බොට් දෝෂයකට මුහුණ දෙන විට හෝ ක්රැෂ් වන විට',
                'bangla': 'যখন বট কোনো ত্রুটির সম্মুখীন হয় বা ক্র্যাশ করে'
            },
            '🔄 Bot Restart': {
                'french': '🔄 Redémarrage du bot',
                'indian': '🔄 बॉट पुनरारंभ',
                'urdu': '🔄 بٹ دوبارہ شروع',
                'nepalese': '🔄 बोट पुनःसुरु',
                'spanish': '🔄 Reinicio del bot',
                'portuguese': '🔄 Reinicialização do bot',
                'japanese': '🔄 ボットの再起動',
                'chinese': '🔄 机器人重启',
                'italian': '🔄 Riavvio del bot',
                'polish': '🔄 Ponowne uruchomienie bota',
                'arabic': '🔄 إعادة تشغيل البوت',
                'srilankan': '🔄 බොට් නැවත ආරම්භ කිරීම',
                'bangla': '🔄 বট পুনরায় চালু'
            },
            'When bot automatically restarts after an issue': {
                'french': 'Lorsque le bot redémarre automatiquement après un problème',
                'indian': 'जब बॉट किसी समस्या के बाद स्वचालित रूप से पुनरारंभ होता है',
                'urdu': 'جب بٹ کسی مسئلے کے بعد خود بخود دوبارہ شروع ہوتا ہے',
                'nepalese': 'जब बोट कुनै समस्या पछि स्वचालित रूपमा पुनःसुरु हुन्छ',
                'spanish': 'Cuando el bot se reinicia automáticamente después de un problema',
                'portuguese': 'Quando o bot reinicia automaticamente após um problema',
                'japanese': '問題发生后ボットが自動的に再起動したとき',
                'chinese': '当机器人在问题发生后自动重启时',
                'italian': 'Quando il bot si riavvia automaticamente dopo un problema',
                'polish': 'Gdy bot automatycznie restartuje po problemie',
                'arabic': 'عندما يعيد البوت التشغيل تلقائياً بعد مشكلة',
                'srilankan': 'ගැටළුවකින් පසු බොට් ස්වයංක්රීයව නැවත ආරම්භ වන විට',
                'bangla': 'যখন কোনো সমস্যার পরে বট স্বয়ংক্রিয়ভাবে পুনরায় চালু হয়'
            },
            'Language Settings': {
                'french': 'Paramètres de langue',
                'indian': 'भाषा सेटिंग्स',
                'urdu': 'زبان کی ترتیبات',
                'nepalese': 'भाषा सेटिङहरू',
                'spanish': 'Configuración de idioma',
                'portuguese': 'Configurações de idioma',
                'japanese': '言語設定',
                'chinese': '语言设置',
                'italian': 'Impostazioni lingua',
                'polish': 'Ustawienia języka',
                'arabic': 'إعدادات اللغة',
                'srilankan': 'භාෂා සැකසුම්',
                'bangla': 'ভাষা সেটিংস'
            },
            'Select your preferred language for the website interface': {
                'french': 'Sélectionnez votre langue préférée pour l\'interface du site web',
                'indian': 'वेबसाइट इंटरफ़ेस के लिए अपनी पसंदीदा भाषा चुनें',
                'urdu': 'ویب سائٹ انٹرفیس کے لیے اپنی پسندیدہ زبان منتخب کریں',
                'nepalese': 'वेबसाइट इन्टरफेसको लागि तपाईंको प्राथमिकता भाषा छनोट गर्नुहोस्',
                'spanish': 'Selecciona tu idioma preferido para la interfaz del sitio web',
                'portuguese': 'Selecione seu idioma preferido para a interface do site',
                'japanese': 'ウェブサイトインターフェースの言語を選択してください',
                'chinese': '选择网站界面的首选语言',
                'italian': 'Seleziona la lingua preferita per l\'interfaccia del sito web',
                'polish': 'Wybierz preferowany język interfejsu witryny',
                'arabic': 'اختر لغتك المفضلة لواجهة الموقع',
                'srilankan': 'වෙබ් අඩවි අතුල්ලය සඳහා ඔබගේ කැමති භාෂාව තෝරන්න',
                'bangla': 'ওয়েবসাইট ইন্টারফেসের জন্য আপনার পছন্দের ভাষা নির্বাচন করুন'
            },
            'Save Language': {
                'french': 'Enregistrer la langue',
                'indian': 'भाषा सहेजें',
                'urdu': 'زبان محفوظ کریں',
                'nepalese': 'भाषा बचत गर्नुहोस्',
                'spanish': 'Guardar idioma',
                'portuguese': 'Salvar idioma',
                'japanese': '言語を保存',
                'chinese': '保存语言',
                'italian': 'Salva lingua',
                'polish': 'Zapisz język',
                'arabic': 'حفظ اللغة',
                'srilankan': 'භාෂාව සුරකින්න',
                'bangla': 'ভাষা সংরক্ষণ করুন'
            },
            'Webhook saved successfully! You will now receive bot status alerts.': {
                'french': 'Webhook enregistré avec succès ! Vous recevrez maintenant des alertes de statut de bot.',
                'indian': 'वेबहुक सफलतापूर्वक सहेजा गया! अब आपको बॉट स्थिति अलर्ट प्राप्त होंगे।',
                'urdu': 'ویب ہک کامیابی سے محفوظ ہو گیا! اب آپ بٹ اسٹیٹس الرٹs حاصل کریں گے۔',
                'nepalese': 'वेबहुक सफलतापूर्वक बचत भयो! अब तपाईं बोट स्थिति सतर्कताहरू प्राप्त गर्नुहुनेछ।',
                'spanish': '¡Webhook guardado exitosamente! Ahora recibirás alertas de estado de bot.',
                'portuguese': 'Webhook salvo com sucesso! Agora você receberá alertas de status do bot.',
                'japanese': 'Webhookが正常に保存されました！これでボットステータスのアラートを受け取ります。',
                'chinese': 'Webhook保存成功！您现在将收到机器人状态警报。',
                'italian': 'Webhook salvato con successo! Riceverai ora avvisi sullo stato del bot.',
                'polish': 'Webhook pomyślnie zapisany! Będziesz teraz otrzymywać alerty o statusie botów.',
                'arabic': 'تم حفظ الويب هوك بنجاح! ستتلقى الآن تنبيهات حالة البوت.',
                'srilankan': 'වෙබ්හුක් සාර්ථකව සුරකින ලදී! ඔබ දැන් බොට් තත්ත්ව ඇලට් ලබා ගනු ඇත.',
                'bangla': 'ওয়েবহুক সফলভাবে সংরক্ষিত হয়েছে! আপনি এখন বট স্ট্যাটাস সতর্কতা পাবেন।'
            },
            'Test message sent! Check your Discord channel.': {
                'french': 'Message de test envoyé ! Vérifiez votre canal Discord.',
                'indian': 'टेस्ट संदेश भेजा गया! अपने डिस्कॉर्ड चैनल की जांच करें।',
                'urdu': 'ٹیسٹ پیپر بھیجا گیا! اپنے ڈسکورڈ چینل کی جانچ کریں۔',
                'nepalese': 'परीक्षण सन्देश पठाइयो! आफ्नो Discord च्यानल जाँच गर्नुहोस्।',
                'spanish': '¡Mensaje de prueba enviado! Revisa tu canal de Discord.',
                'portuguese': 'Mensagem de teste enviada! Verifique seu canal do Discord.',
                'japanese': 'テストメッセージを送信しました！Discordチャネルを確認してください。',
                'chinese': '测试消息已发送！请检查您的Discord频道。',
                'italian': 'Messaggio di test inviato! Controlla il tuo canale Discord.',
                'polish': 'Wiadomość testowa wysłana! Sprawdź swój kanał Discord.',
                'arabic': 'تم إرسال رسالة اختبار! تحقق من قناة Discord الخاصة بك.',
                'srilankan': 'පරීක්ෂණ පණිවිඩය යවන ලදී! ඔබගේ Discord නාලිකාව පරීක්ෂා කරන්න.',
                'bangla': 'পরীক্ষামূলক বার্তা পাঠানো হয়েছে! আপনার ডিসকর্ড চ্যানেল চেক করুন।'
            },
            'Webhook removed successfully': {
                'french': 'Webhook supprimé avec succès',
                'indian': 'वेबहुक सफलतापूर्वक हटा दिया गया',
                'urdu': 'ویب ہک کامیابی سے ہٹا دیا گیا',
                'nepalese': 'वेबहुक सफलतापूर्वक हटाइयो',
                'spanish': 'Webhook eliminado exitosamente',
                'portuguese': 'Webhook removido com sucesso',
                'japanese': 'Webhookが正常に削除されました',
                'chinese': 'Webhook删除成功',
                'italian': 'Webhook rimosso con successo',
                'polish': 'Webhook pomyślnie usunięty',
                'arabic': 'تم إزالة الويب هوك بنجاح',
                'srilankan': 'වෙබ්හුක් සාර්ථකව ඉවත් කරන ලදී',
                'bangla': 'ওয়েবহুক সফলভাবে সরানো হয়েছে'
            },
            'Language saved successfully!': {
                'french': 'Langue enregistrée avec succès !',
                'indian': 'भाषा सफलतापूर्वक सहेजी गई!',
                'urdu': 'زبان کامیابی سے محفوظ ہو گئی!',
                'nepalese': 'भाषा सफलतापूर्वक बचत गरियो!',
                'spanish': '¡Idioma guardado exitosamente!',
                'portuguese': 'Idioma salvo com sucesso!',
                'japanese': '言語が正常に保存されました！',
                'chinese': '语言保存成功！',
                'italian': 'Lingua salvata con successo!',
                'polish': 'Język pomyślnie zapisany!',
                'arabic': 'تم حفظ اللغة بنجاح!',
                'srilankan': 'භාෂාව සාර්ථකව සුරකින ලදී!',
                'bangla': 'ভাষা সফলভাবে সংরক্ষিত হয়েছে!'
            },
            // Additional translations for new elements
            'Opsicos': {
                'french': 'Opsicos',
                'indian': 'ओप्सिकोस',
                'urdu': 'اوپسیکوس',
                'nepalese': 'ओप्सिकोस',
                'spanish': 'Opsicos',
                'portuguese': 'Opsicos',
                'japanese': 'オプシコス',
                'chinese': 'Opsicos',
                'italian': 'Opsicos',
                'polish': 'Opsicos',
                'arabic': 'أوبسيكوس',
                'srilankan': 'ඔප්සිකොස්',
                'bangla': 'অপসিকোস'
            },
            '⚙️ Settings': {
                'french': '⚙️ Paramètres',
                'indian': '⚙️ सेटिंग्स',
                'urdu': '⚙️ ترتیبات',
                'nepalese': '⚙️ सेटिङहरू',
                'spanish': '⚙️ Configuración',
                'portuguese': '⚙️ Configurações',
                'japanese': '⚙️ 設定',
                'chinese': '⚙️ 设置',
                'italian': '⚙️ Impostazioni',
                'polish': '⚙️ Ustawienia',
                'arabic': '⚙️ الإعدادات',
                'srilankan': '⚙️ සැකසුම්',
                'bangla': '⚙️ সেটিংস'
            },
            'Your webhook URL should start with: https://discord.com/api/webhooks/': {
                'french': 'Votre URL webhook devrait commencer par : https://discord.com/api/webhooks/',
                'indian': 'आपका वेबहुक URL इसके साथ शुरू होना चाहिए: https://discord.com/api/webhooks/',
                'urdu': 'آپ کا ویب ہوک URL اس سے شروع ہونا چاہیے: https://discord.com/api/webhooks/',
                'nepalese': 'तपाईंको वेबहुक URL यसबाट सुरु हुनुपर्छ: https://discord.com/api/webhooks/',
                'spanish': 'Tu URL webhook debería comenzar con: https://discord.com/api/webhooks/',
                'portuguese': 'Seu URL webhook deve começar com: https://discord.com/api/webhooks/',
                'japanese': 'あなたのWebhook URLは次から始まる必要があります: https://discord.com/api/webhooks/',
                'chinese': '您的Webhook URL应该以：https://discord.com/api/webhooks/ 开始',
                'italian': 'Il tuo URL webhook dovrebbe iniziare con: https://discord.com/api/webhooks/',
                'polish': 'Twój URL webhook powinien zaczynać się od: https://discord.com/api/webhooks/',
                'arabic': 'يجب أن يبدأ عنوان URL الخاص بك بـ: https://discord.com/api/webhooks/',
                'srilankan': 'ඔබගේ වෙබ්හුක් URL මෙමින් ආරම්භ විය යුතුය: https://discord.com/api/webhooks/',
                'bangla': 'আপনার ওয়েবহুক URL এর সাথে শুরু হওয়া উচিত: https://discord.com/api/webhooks/'
            }
        };
    }
    
    /**
     * Initialize the translation system
     */
    init() {
        this.scanAndTranslateElements();
        this.setupLanguageChangeHandler();
        this.initialized = true;
    }
    
    /**
     * Scan the page for translatable elements and store them
     */
    scanAndTranslateElements() {
        // Define ID-based translations
        const idTranslations = {
            'sidebarTitle': 'Opsicos',
            'sidebarSubtitle': 'Dashboard',
            'navMyBots': 'My Bots',
            'navKnowledge': 'Knowledge Management',
            'navStoredKnowledge': 'Stored Knowledge',
            'navBehavior': '🎭 Bot Behavior',
            'navUptime': '📊 Bot Uptime Status',
            'navFeatures': '🔧 Features',
            'navPlayground': '🎮 Playground',
            'navSettings': '⚙️ Settings',
            'navTerms': '📋 Terms of Service',
            'navPrivacy': '🔒 Privacy Policy',
            'pageTitle': '⚙️ Settings',
            'logoutBtn': 'Logout',
            'webhookTitle': '🔔 Bot Status Webhook Alerts',
            'webhookDescription': 'Get real-time notifications about your bot status changes directly in your Discord server. Configure a webhook URL below to receive automated alerts when your bots go online, offline, or encounter issues.',
            'webhookGuideTitle': 'How to Create a Discord Webhook:',
            'step1': 'Go to your Discord server and select the channel where you want to receive alerts',
            'step2': 'Right-click the channel → Edit Channel',
            'step3': 'Go to Integrations tab → Click Create Webhook',
            'step4': 'Name your webhook (e.g., "Opsicos Bot Alerts")',
            'step5': 'Copy the Webhook URL and paste it below',
            'step6': 'Click Save Changes in Discord',
            'webhookStatusLabel': 'Webhook Status:',
            'webhookStatusText': 'Not configured',
            'webhookUrlLabel': 'Discord Webhook URL',
            'webhookUrlHelp': 'Your webhook URL should start with: https://discord.com/api/webhooks/',
            'saveWebhookBtn': 'Save Webhook',
            'testWebhookBtn': 'Test Webhook',
            'removeWebhookBtn': 'Remove Webhook',
            'alertEventsTitle': 'Alert Events:',
            'eventStarted': '🟢 Bot Started',
            'eventStartedDesc': 'When you manually start a bot',
            'eventStopped': '🔴 Bot Stopped',
            'eventStoppedDesc': 'When you manually stop a bot',
            'eventOnline': '✅ Bot Online',
            'eventOnlineDesc': 'When bot successfully connects to Discord',
            'eventOffline': '⚠️ Bot Offline',
            'eventOfflineDesc': 'When bot disconnects or goes offline',
            'eventError': '❌ Bot Error',
            'eventErrorDesc': 'When bot encounters an error or crashes',
            'eventRestart': '🔄 Bot Restart',
            'eventRestartDesc': 'When bot automatically restarts after an issue',
            'languageTitle': '🌐 Language Settings',
            'languageDescription': 'Select your preferred language for the website interface. This will instantly translate all text on the page without requiring a refresh.',
            'websiteLanguageLabel': 'Website Language',
            'languageHelp': 'Choose your preferred language for the Opsicos interface. This setting only affects the website text, not your bot responses.',
            'saveLanguageBtn': 'Save Language'
        };

        // Handle ID-based translations
        Object.keys(idTranslations).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const text = idTranslations[id];
                if (text && this.translations[text]) {
                    // Store the original text and element
                    this.translatedElements.set(element, text);
                }
            }
        });

        // Find all elements with text content that should be translated
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'span', 'button', 'label', 'option',
            'a', 'div.card-header', 'div.sidebar-nav a'
        ];
        
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                // Skip elements that are already handled by ID
                if (element.id && idTranslations[element.id]) {
                    return;
                }
                
                const text = element.textContent.trim();
                if (text && this.translations[text]) {
                    // Store the original text and element
                    this.translatedElements.set(element, text);
                }
            });
        });
    }
    
    /**
     * Translate all elements to the specified language
     * @param {string} language - The target language
     */
    translateTo(language) {
        if (!this.supportedLanguages[language]) {
            console.error(`Language ${language} is not supported`);
            return;
        }
        
        console.log(`Translating to: ${language}`);
        this.currentLanguage = language;
        
        // Store in localStorage as backup
        try {
            localStorage.setItem('opsicos_language', language);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
        
        this.translatedElements.forEach((originalText, element) => {
            // Check if element still exists in DOM
            if (!document.contains(element)) {
                return;
            }
            
            const translation = this.getTranslation(originalText, language);
            if (translation && translation !== originalText) {
                element.textContent = translation;
            } else {
                element.textContent = originalText;
            }
        });
        
        // Update HTML lang attribute
        document.documentElement.lang = this.supportedLanguages[language].code;
    }
    
    /**
     * Get translation for a specific text in the target language
     * @param {string} text - The original text
     * @param {string} language - The target language
     * @returns {string} - The translated text or original if not found
     */
    getTranslation(text, language = this.currentLanguage) {
        if (language === 'english') {
            return text;
        }
        
        return this.translations[text]?.[language] || text;
    }
    
    /**
     * Setup language change handler for dropdown
     */
    setupLanguageChangeHandler() {
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            // Don't auto-translate on change - only when user clicks Save
            // This prevents unwanted translations
            languageSelect.addEventListener('change', (e) => {
                // Just update the dropdown, don't translate yet
                console.log('Language selected:', e.target.value);
            });
        }
    }
    
    /**
     * Save user's language preference
     * @param {string} language - The selected language
     */
    async saveLanguagePreference(language) {
        try {
            // Save to localStorage immediately
            localStorage.setItem('opsicos_language', language);
            
            const response = await fetch('/settings/language', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ language })
            });
            
            if (response.ok) {
                console.log('Language saved to server:', language);
                return true;
            } else {
                console.error('Failed to save language preference to server');
                return false;
            }
        } catch (error) {
            console.error('Error saving language preference:', error);
            return false;
        }
    }
    
    /**
     * Load user's language preference
     */
    async loadLanguagePreference() {
        try {
            // First try localStorage for instant load
            const localLang = localStorage.getItem('opsicos_language');
            if (localLang && this.supportedLanguages[localLang]) {
                console.log('Loaded language from localStorage:', localLang);
                return localLang;
            }
            
            // Then fetch from server
            const response = await fetch('/settings/language', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.language && this.supportedLanguages[data.language]) {
                    // Store in localStorage for next time
                    localStorage.setItem('opsicos_language', data.language);
                    console.log('Loaded language from server:', data.language);
                    return data.language;
                }
            }
        } catch (error) {
            console.error('Error loading language preference:', error);
        }
        
        return 'english'; // Default language
    }
    
    /**
     * Initialize the language system with user's preference
     */
    async initializeWithUserPreference() {
        // Prevent multiple initializations
        if (this.isLoadingPreference) {
            return;
        }
        
        this.isLoadingPreference = true;
        const savedLanguage = await this.loadLanguagePreference();
        const languageSelect = document.getElementById('languageSelect');
        
        if (languageSelect) {
            languageSelect.value = savedLanguage;
        }
        
        // Apply the saved language immediately and keep it
        if (savedLanguage && savedLanguage !== 'english') {
            this.currentLanguage = savedLanguage;
            this.translateTo(savedLanguage);
        }
        
        this.isLoadingPreference = false;
    }
    
    /**
     * Manual save function to be called from Save Language button
     */
    async saveAndApplyLanguage() {
        const languageSelect = document.getElementById('languageSelect');
        if (!languageSelect) {
            console.error('Language selector not found');
            return false;
        }
        
        const selectedLanguage = languageSelect.value;
        
        // Save to backend first
        const saved = await this.saveLanguagePreference(selectedLanguage);
        
        if (saved) {
            // Then apply the translation
            this.translateTo(selectedLanguage);
            return true;
        }
        
        return false;
    }
}

// Create global instance
window.languageTranslator = new LanguageTranslator();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.languageTranslator.initialized) {
        window.languageTranslator.init();
        window.languageTranslator.initializeWithUserPreference();
    }
});