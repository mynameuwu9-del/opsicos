/**
 * SEO Meta Tags Manager for Opsicos
 * Dynamically adds SEO meta tags to pages that don't have them
 */

class SEOMetaManager {
    constructor() {
        this.baseUrl = 'https://opsicos.genaura.xyz';
        this.siteName = 'Opsicos';
        this.defaultImage = `${this.baseUrl}/images/opsicos-preview.png`;
        this.twitterHandle = '@opsicos';
        
        // Page-specific SEO data
        this.pageData = {
            '/dashboard': {
                title: 'Discord Bot Dashboard - Manage Your AI Bots | Opsicos',
                description: 'Manage multiple Discord bots from a single dashboard. Monitor uptime, configure AI models, and track performance with real-time analytics.',
                keywords: 'discord bot dashboard, bot management, discord bot monitoring, bot analytics, discord bot control panel'
            },
            '/features': {
                title: 'Discord Bot Features - AI Integration & Monitoring | Opsicos',
                description: 'Explore powerful Discord bot features including AI integration, auto-restart, real-time monitoring, and enterprise-grade reliability.',
                keywords: 'discord bot features, AI discord bot, bot monitoring, auto restart, discord automation, bot reliability'
            },
            '/playground': {
                title: 'API Playground - Test Discord Bot APIs | Opsicos',
                description: 'Test and explore Opsicos Discord bot APIs in our interactive playground. Perfect for developers building custom integrations.',
                keywords: 'discord bot API, API playground, bot development, discord bot testing, API documentation'
            },
            '/login': {
                title: 'Login - Access Your Discord Bot Dashboard | Opsicos',
                description: 'Login to your Opsicos account to manage Discord bots, monitor performance, and configure AI integrations.',
                keywords: 'discord bot login, bot dashboard access, opsicos login, discord bot management'
            },
            '/settings': {
                title: 'Bot Settings - Configure Your Discord Bots | Opsicos',
                description: 'Configure Discord bot settings, AI models, permissions, and advanced features through our intuitive settings panel.',
                keywords: 'discord bot settings, bot configuration, AI model settings, discord bot permissions'
            },
            '/bot-monitor': {
                title: 'Bot Monitoring - Real-time Discord Bot Analytics | Opsicos',
                description: 'Monitor Discord bot performance with real-time analytics, uptime tracking, error logs, and comprehensive health checks.',
                keywords: 'discord bot monitoring, bot analytics, uptime tracking, bot performance, discord bot health'
            },
            '/system-monitor': {
                title: 'System Monitor - Infrastructure Health Dashboard | Opsicos',
                description: 'Monitor system health, resource usage, and infrastructure performance for your Discord bot deployment.',
                keywords: 'system monitoring, infrastructure health, resource monitoring, bot system status'
            },
            '/privacy': {
                title: 'Privacy Policy - Data Protection & Security | Opsicos',
                description: 'Learn how Opsicos protects your data and privacy when using our Discord bot management platform.',
                keywords: 'privacy policy, data protection, discord bot privacy, security policy'
            },
            '/terms': {
                title: 'Terms of Service - Usage Guidelines | Opsicos',
                description: 'Read the terms of service for using Opsicos Discord bot management platform and related services.',
                keywords: 'terms of service, usage terms, discord bot terms, service agreement'
            }
        };
    }

    init() {
        // Only run if we're not on the main pages that already have SEO
        const currentPath = window.location.pathname;
        if (this.pageData[currentPath] && !this.hasExistingSEO()) {
            this.addSEOTags(currentPath);
        }
        
        // Add canonical link if missing
        this.addCanonicalLink();
        
        // Add structured data for all pages
        this.addStructuredData();
    }

    hasExistingSEO() {
        return document.querySelector('meta[name="description"]') !== null;
    }

    addSEOTags(path) {
        const data = this.pageData[path];
        if (!data) return;

        // Update title
        document.title = data.title;

        // Add meta tags
        this.addMetaTag('description', data.description);
        this.addMetaTag('keywords', data.keywords);
        this.addMetaTag('author', 'Opsicos');
        this.addMetaTag('robots', 'index, follow');

        // Add Open Graph tags
        this.addMetaProperty('og:title', data.title);
        this.addMetaProperty('og:description', data.description);
        this.addMetaProperty('og:url', `${this.baseUrl}${path}`);
        this.addMetaProperty('og:type', 'website');
        this.addMetaProperty('og:image', this.defaultImage);
        this.addMetaProperty('og:site_name', this.siteName);

        // Add Twitter Card tags
        this.addMetaTag('twitter:card', 'summary_large_image');
        this.addMetaTag('twitter:title', data.title);
        this.addMetaTag('twitter:description', data.description);
        this.addMetaTag('twitter:image', this.defaultImage);
        this.addMetaTag('twitter:site', this.twitterHandle);
    }

    addMetaTag(name, content) {
        if (document.querySelector(`meta[name="${name}"]`)) return;
        
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
    }

    addMetaProperty(property, content) {
        if (document.querySelector(`meta[property="${property}"]`)) return;
        
        const meta = document.createElement('meta');
        meta.setAttribute('property', property);
        meta.content = content;
        document.head.appendChild(meta);
    }

    addCanonicalLink() {
        if (document.querySelector('link[rel="canonical"]')) return;
        
        const canonical = document.createElement('link');
        canonical.rel = 'canonical';
        canonical.href = `${this.baseUrl}${window.location.pathname}`;
        document.head.appendChild(canonical);
    }

    addStructuredData() {
        if (document.querySelector('script[type="application/ld+json"]')) return;
        
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": document.title,
            "description": document.querySelector('meta[name="description"]')?.content || '',
            "url": `${this.baseUrl}${window.location.pathname}`,
            "isPartOf": {
                "@type": "WebSite",
                "name": this.siteName,
                "url": this.baseUrl
            },
            "about": {
                "@type": "SoftwareApplication",
                "name": "Opsicos",
                "applicationCategory": "BusinessApplication",
                "description": "Advanced Discord bot management platform"
            }
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    // Method to track page views for analytics
    trackPageView() {
        // Google Analytics 4 tracking
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                page_title: document.title,
                page_location: window.location.href
            });
        }

        // Custom analytics tracking
        if (typeof analytics !== 'undefined') {
            analytics.page({
                title: document.title,
                url: window.location.href,
                path: window.location.pathname
            });
        }
    }
}

// Initialize SEO manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const seoManager = new SEOMetaManager();
    seoManager.init();
    seoManager.trackPageView();
});

// Export for use in other scripts
window.SEOMetaManager = SEOMetaManager;
