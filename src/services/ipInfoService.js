const axios = require('axios');

class IPInfoService {
  constructor() {
    // Using multiple free IP info services for redundancy
    this.services = {
      ipapi: 'http://ip-api.com/json/',
      ipinfo: 'https://ipinfo.io/',
      ipdata: 'https://api.ipdata.co/'
    };
  }

  // Get client IP from request
  getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress;
    
    // Remove IPv6 prefix if present
    if (ip && ip.includes('::ffff:')) {
      return ip.replace('::ffff:', '');
    }
    
    return ip || '0.0.0.0';
  }

  // Get device information from user agent
  getDeviceInfo(req) {
    const ua = req.useragent || {};

    return {
      deviceModel: this.getDeviceModel(ua),
      deviceType: ua.isMobile ? 'Mobile' : ua.isTablet ? 'Tablet' : 'Desktop',
      deviceBrand: this.getDeviceBrand(ua),
      os: ua.os || 'Unknown',
      browser: ua.browser || 'Unknown',
      platform: ua.platform || 'Unknown'
    };
  }

  // Extract device model from user agent
  getDeviceModel(ua) {
    const source = ua.source || '';

    // iPhone models with detailed detection
    if (source.includes('iPhone')) {
      const match = source.match(/iPhone(\d+,\d+)/);
      if (match) {
        return this.getIPhoneModelName(match[1]);
      }
      // Fallback for basic iPhone detection
      const basicMatch = source.match(/iPhone[\d,]+/);
      if (basicMatch) return basicMatch[0];
      return 'iPhone';
    }

    // iPad models
    if (source.includes('iPad')) {
      const match = source.match(/iPad(\d+,\d+)/);
      if (match) {
        return this.getIPadModelName(match[1]);
      }
      const basicMatch = source.match(/iPad[\d,]+/);
      if (basicMatch) return basicMatch[0];
      return 'iPad';
    }

    // Mac models - Enhanced detection
    if (source.includes('Macintosh') || source.includes('Mac OS X') || source.includes('macOS')) {
      // Try to detect specific Mac models from user agent patterns
      if (source.includes('MacBookPro')) return 'MacBook Pro';
      if (source.includes('MacBookAir')) return 'MacBook Air';
      if (source.includes('iMac')) return 'iMac';
      if (source.includes('Macmini')) return 'Mac mini';
      if (source.includes('MacPro')) return 'Mac Pro';
      if (source.includes('MacBook')) return 'MacBook';

      // Check for processor architecture
      if (source.includes('arm64') || source.includes('Apple Silicon')) {
        return 'Mac (Apple Silicon)';
      }
      if (source.includes('Intel') || source.includes('x86_64')) {
        return 'Mac (Intel)';
      }

      // Try to extract Mac model from platform info
      if (ua.platform && ua.platform.includes('Mac')) {
        if (ua.platform.includes('Intel')) return 'Mac (Intel)';
        if (ua.platform.includes('ARM') || ua.platform.includes('arm64')) return 'Mac (Apple Silicon)';
      }

      // Check OS version for newer Macs (Apple Silicon typically runs macOS 11+)
      const osMatch = source.match(/Mac OS X (\d+)_(\d+)/);
      if (osMatch) {
        const majorVersion = parseInt(osMatch[1]);
        const minorVersion = parseInt(osMatch[2]);

        // macOS Big Sur (11.0) and later often indicate Apple Silicon
        if (majorVersion >= 11 || (majorVersion === 10 && minorVersion >= 16)) {
          return 'Mac (likely Apple Silicon)';
        } else {
          return 'Mac (likely Intel)';
        }
      }

      return 'Mac';
    }

    // Android device models - enhanced detection
    if (source.includes('Android')) {
      // Try to extract specific Android device model
      const deviceMatch = this.extractAndroidDeviceModel(source);
      if (deviceMatch) return deviceMatch;

      // Fallback to generic extraction
      const match = source.match(/\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(';');
        if (parts.length >= 3) {
          const devicePart = parts[parts.length - 1].trim();
          // Clean up the device name
          return this.cleanDeviceName(devicePart);
        }
      }
      return 'Android Device';
    }

    // Windows devices
    if (source.includes('Windows')) {
      if (source.includes('Windows NT 10.0')) return 'Windows 10/11 PC';
      if (source.includes('Windows NT 6.3')) return 'Windows 8.1 PC';
      if (source.includes('Windows NT 6.2')) return 'Windows 8 PC';
      if (source.includes('Windows NT 6.1')) return 'Windows 7 PC';
      return 'Windows PC';
    }

    // Linux
    if (source.includes('Linux')) {
      if (source.includes('Ubuntu')) return 'Ubuntu Linux';
      if (source.includes('Fedora')) return 'Fedora Linux';
      if (source.includes('CentOS')) return 'CentOS Linux';
      if (source.includes('Debian')) return 'Debian Linux';
      return 'Linux PC';
    }

    return ua.platform || 'Unknown Device';
  }

  // Extract device brand
  getDeviceBrand(ua) {
    const source = ua.source || '';

    if (source.includes('iPhone') || source.includes('iPad') || source.includes('Mac')) {
      return 'Apple';
    }
    if (source.includes('Samsung')) return 'Samsung';
    if (source.includes('Huawei')) return 'Huawei';
    if (source.includes('Xiaomi') || source.includes('Mi ') || source.includes('Redmi')) return 'Xiaomi';
    if (source.includes('OnePlus')) return 'OnePlus';
    if (source.includes('Google Pixel') || source.includes('Pixel')) return 'Google';
    if (source.includes('LG')) return 'LG';
    if (source.includes('Sony')) return 'Sony';
    if (source.includes('Nokia')) return 'Nokia';
    if (source.includes('Motorola') || source.includes('Moto')) return 'Motorola';
    if (source.includes('Oppo')) return 'Oppo';
    if (source.includes('Vivo')) return 'Vivo';
    if (source.includes('Realme')) return 'Realme';
    if (source.includes('Honor')) return 'Honor';
    if (source.includes('Asus')) return 'Asus';
    if (source.includes('HTC')) return 'HTC';
    if (source.includes('Lenovo')) return 'Lenovo';
    if (source.includes('Windows')) return 'Microsoft';

    return 'Unknown';
  }

  // Get iPhone model name from identifier
  getIPhoneModelName(identifier) {
    const models = {
      '1,1': 'iPhone (Original)',
      '1,2': 'iPhone 3G',
      '2,1': 'iPhone 3GS',
      '3,1': 'iPhone 4', '3,2': 'iPhone 4', '3,3': 'iPhone 4',
      '4,1': 'iPhone 4S',
      '5,1': 'iPhone 5', '5,2': 'iPhone 5',
      '5,3': 'iPhone 5c', '5,4': 'iPhone 5c',
      '6,1': 'iPhone 5s', '6,2': 'iPhone 5s',
      '7,1': 'iPhone 6 Plus', '7,2': 'iPhone 6',
      '8,1': 'iPhone 6s', '8,2': 'iPhone 6s Plus',
      '8,4': 'iPhone SE (1st gen)',
      '9,1': 'iPhone 7', '9,3': 'iPhone 7',
      '9,2': 'iPhone 7 Plus', '9,4': 'iPhone 7 Plus',
      '10,1': 'iPhone 8', '10,4': 'iPhone 8',
      '10,2': 'iPhone 8 Plus', '10,5': 'iPhone 8 Plus',
      '10,3': 'iPhone X', '10,6': 'iPhone X',
      '11,2': 'iPhone XS',
      '11,4': 'iPhone XS Max', '11,6': 'iPhone XS Max',
      '11,8': 'iPhone XR',
      '12,1': 'iPhone 11',
      '12,3': 'iPhone 11 Pro',
      '12,5': 'iPhone 11 Pro Max',
      '12,8': 'iPhone SE (2nd gen)',
      '13,1': 'iPhone 12 mini',
      '13,2': 'iPhone 12',
      '13,3': 'iPhone 12 Pro',
      '13,4': 'iPhone 12 Pro Max',
      '14,2': 'iPhone 13 mini',
      '14,3': 'iPhone 13',
      '14,4': 'iPhone 13 Pro',
      '14,5': 'iPhone 13 Pro Max',
      '14,6': 'iPhone SE (3rd gen)',
      '14,7': 'iPhone 14',
      '14,8': 'iPhone 14 Plus',
      '15,2': 'iPhone 14 Pro',
      '15,3': 'iPhone 14 Pro Max',
      '15,4': 'iPhone 15',
      '15,5': 'iPhone 15 Plus',
      '16,1': 'iPhone 15 Pro',
      '16,2': 'iPhone 15 Pro Max'
    };

    return models[identifier] || `iPhone ${identifier}`;
  }

  // Get iPad model name from identifier
  getIPadModelName(identifier) {
    const models = {
      '1,1': 'iPad (1st gen)',
      '2,1': 'iPad 2', '2,2': 'iPad 2', '2,3': 'iPad 2', '2,4': 'iPad 2',
      '3,1': 'iPad (3rd gen)', '3,2': 'iPad (3rd gen)', '3,3': 'iPad (3rd gen)',
      '3,4': 'iPad (4th gen)', '3,5': 'iPad (4th gen)', '3,6': 'iPad (4th gen)',
      '4,1': 'iPad Air', '4,2': 'iPad Air', '4,3': 'iPad Air',
      '5,1': 'iPad Air 2', '5,3': 'iPad Air 2',
      '6,3': 'iPad Pro 9.7"', '6,4': 'iPad Pro 9.7"',
      '6,7': 'iPad Pro 12.9"', '6,8': 'iPad Pro 12.9"',
      '7,1': 'iPad Pro 12.9" (2nd gen)', '7,2': 'iPad Pro 12.9" (2nd gen)',
      '7,3': 'iPad Pro 10.5"', '7,4': 'iPad Pro 10.5"',
      '8,1': 'iPad Pro 11"', '8,2': 'iPad Pro 11"', '8,3': 'iPad Pro 11"', '8,4': 'iPad Pro 11"',
      '8,5': 'iPad Pro 12.9" (3rd gen)', '8,6': 'iPad Pro 12.9" (3rd gen)', '8,7': 'iPad Pro 12.9" (3rd gen)', '8,8': 'iPad Pro 12.9" (3rd gen)',
      '11,1': 'iPad mini (5th gen)', '11,2': 'iPad mini (5th gen)',
      '11,3': 'iPad Air (3rd gen)', '11,4': 'iPad Air (3rd gen)',
      '12,1': 'iPad (9th gen)', '12,2': 'iPad (9th gen)',
      '13,1': 'iPad Air (4th gen)', '13,2': 'iPad Air (4th gen)',
      '13,4': 'iPad Pro 11" (3rd gen)', '13,5': 'iPad Pro 11" (3rd gen)', '13,6': 'iPad Pro 11" (3rd gen)', '13,7': 'iPad Pro 11" (3rd gen)',
      '13,8': 'iPad Pro 12.9" (5th gen)', '13,9': 'iPad Pro 12.9" (5th gen)', '13,10': 'iPad Pro 12.9" (5th gen)', '13,11': 'iPad Pro 12.9" (5th gen)',
      '14,1': 'iPad mini (6th gen)', '14,2': 'iPad mini (6th gen)'
    };

    return models[identifier] || `iPad ${identifier}`;
  }

  // Extract Android device model with enhanced detection
  extractAndroidDeviceModel(source) {
    // Samsung Galaxy series
    if (source.includes('Samsung')) {
      const galaxyMatch = source.match(/SM-([A-Z]\d+[A-Z]?)/);
      if (galaxyMatch) {
        return this.getSamsungModelName(galaxyMatch[1]);
      }
      if (source.includes('Galaxy')) {
        const match = source.match(/Galaxy ([^;)]+)/);
        if (match) return `Samsung Galaxy ${match[1].trim()}`;
      }
      return 'Samsung Device';
    }

    // Xiaomi devices
    if (source.includes('Xiaomi') || source.includes('Mi ') || source.includes('Redmi')) {
      const match = source.match(/(Mi \w+|Redmi [^;)]+|Xiaomi [^;)]+)/);
      if (match) return match[1].trim();
      return 'Xiaomi Device';
    }

    // Google Pixel
    if (source.includes('Pixel')) {
      const match = source.match(/Pixel ([^;)]+)/);
      if (match) return `Google Pixel ${match[1].trim()}`;
      return 'Google Pixel';
    }

    // OnePlus
    if (source.includes('OnePlus')) {
      const match = source.match(/OnePlus ([^;)]+)/);
      if (match) return `OnePlus ${match[1].trim()}`;
      return 'OnePlus Device';
    }

    // Huawei
    if (source.includes('Huawei')) {
      const match = source.match(/Huawei ([^;)]+)/);
      if (match) return `Huawei ${match[1].trim()}`;
      return 'Huawei Device';
    }

    return null;
  }

  // Get Samsung model name from SM code
  getSamsungModelName(smCode) {
    const models = {
      'G920': 'Galaxy S6',
      'G925': 'Galaxy S6 Edge',
      'G930': 'Galaxy S7',
      'G935': 'Galaxy S7 Edge',
      'G950': 'Galaxy S8',
      'G955': 'Galaxy S8+',
      'G960': 'Galaxy S9',
      'G965': 'Galaxy S9+',
      'G970': 'Galaxy S10e',
      'G973': 'Galaxy S10',
      'G975': 'Galaxy S10+',
      'G981': 'Galaxy S20',
      'G985': 'Galaxy S20+',
      'G988': 'Galaxy S20 Ultra',
      'G991': 'Galaxy S21',
      'G996': 'Galaxy S21+',
      'G998': 'Galaxy S21 Ultra',
      'S901': 'Galaxy S22',
      'S906': 'Galaxy S22+',
      'S908': 'Galaxy S22 Ultra',
      'S911': 'Galaxy S23',
      'S916': 'Galaxy S23+',
      'S918': 'Galaxy S23 Ultra',
      'A105': 'Galaxy A10',
      'A205': 'Galaxy A20',
      'A305': 'Galaxy A30',
      'A405': 'Galaxy A40',
      'A505': 'Galaxy A50',
      'A705': 'Galaxy A70',
      'F415': 'Galaxy F41',
      'M215': 'Galaxy M21',
      'M315': 'Galaxy M31'
    };

    // Try exact match first
    if (models[smCode]) return `Samsung ${models[smCode]}`;

    // Try partial matches for similar models
    const prefix = smCode.substring(0, 3);
    for (const [code, name] of Object.entries(models)) {
      if (code.startsWith(prefix)) {
        return `Samsung ${name} (${smCode})`;
      }
    }

    return `Samsung SM-${smCode}`;
  }

  // Clean up device name
  cleanDeviceName(deviceName) {
    // Remove common unwanted parts
    return deviceName
      .replace(/Build\/.*$/, '')
      .replace(/wv\).*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Get IP information including VPN detection
  async getIPInfo(ip) {
    try {
      // Skip for localhost
      if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '0.0.0.0') {
        return {
          ip,
          city: 'Localhost',
          country: 'Local',
          countryCode: 'LO',
          isp: 'Local Network',
          vpn: false,
          vpnInfo: 'Local connection'
        };
      }

      // Skip if IP is private/internal
      if (this.isPrivateIP(ip)) {
        return {
          ip,
          city: 'Internal Network',
          country: 'Private',
          countryCode: 'PR',
          isp: 'Private Network',
          vpn: false,
          vpnInfo: 'Private network'
        };
      }

      // Try ip-api.com first (includes VPN detection) - with better error handling
      try {
        const response = await axios.get(`${this.services.ipapi}${ip}?fields=status,country,countryCode,region,city,isp,org,as,proxy,hosting,timezone`, {
          timeout: 8000, // Increased timeout
          headers: {
            'User-Agent': 'Opsicos-AdminPanel/1.0',
            'Accept': 'application/json'
          }
        });
        
        console.log('🔍 IP-API.com raw response for', ip, ':', response.data);
        
        if (response.data && response.data.status === 'success') {
          const isp = response.data.isp || response.data.org || 'Unknown ISP';
          const org = response.data.org || response.data.isp || '';
          
          // Enhanced VPN detection: check API flags AND ISP name
          const apiVpnDetected = response.data.proxy || response.data.hosting || false;
          const ispVpnDetected = this.checkIfVPN(isp) || this.checkIfVPN(org);
          const isVpn = apiVpnDetected || ispVpnDetected;
          
          const ipData = {
            ip,
            city: response.data.city || this.getLocationFallback(ip).city,
            country: response.data.country || this.getLocationFallback(ip).country,
            countryCode: response.data.countryCode || this.getLocationFallback(ip).countryCode,
            isp: isp,
            vpn: isVpn,
            proxy: response.data.proxy || false,
            hosting: response.data.hosting || false,
            vpnInfo: apiVpnDetected ? 'Proxy/VPN detected by API' : ispVpnDetected ? 'VPN/Hosting detected by ISP name' : 'Regular ISP',
            as: response.data.as || 'Unknown',
            region: response.data.region || 'Unknown',
            timezone: response.data.timezone || 'Unknown'
          };
          console.log('✅ IP-API.com processed data:', JSON.stringify(ipData, null, 2));
          console.log('🔍 VPN Detection - API flag:', apiVpnDetected, 'ISP check:', ispVpnDetected, 'Final:', isVpn);
          return ipData;
        } else {
          console.log('❌ IP-API.com returned error status:', response.data?.message || 'No error message');
        }
      } catch (error) {
        console.log('❌ ip-api.com failed:', error.message);
      }

      // Try ipgeolocation.io as second option
      try {
        const response = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=&ip=${ip}`, {
          timeout: 8000
        });
        
        if (response.data && response.data.country_name) {
          const isp = response.data.isp || 'Unknown';
          const isVpn = this.checkIfVPN(isp);
          console.log('✅ ipgeolocation.io response for', ip);
          console.log('🔍 VPN Detection (ipgeolocation) - ISP:', isp, 'VPN:', isVpn);
          return {
            ip,
            city: response.data.city || 'Unknown',
            country: response.data.country_name || 'Unknown',
            countryCode: response.data.country_code2 || 'XX',
            isp: isp,
            vpn: isVpn,
            proxy: isVpn,
            hosting: isVpn,
            vpnInfo: isVpn ? 'VPN/Hosting detected by ISP name' : 'Regular ISP',
            region: response.data.state_prov || 'Unknown'
          };
        }
      } catch (error) {
        console.log('❌ ipgeolocation.io failed:', error.message);
      }

      // Fallback to ipinfo.io
      try {
        const response = await axios.get(`${this.services.ipinfo}${ip}/json`, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Opsicos-AdminPanel/1.0',
            'Accept': 'application/json'
          }
        });
        
        if (response.data && !response.data.error) {
          const org = response.data.org || 'Unknown';
          const isVpn = this.checkIfVPN(org);
          console.log('✅ ipinfo.io response for', ip);
          console.log('🔍 VPN Detection (ipinfo) - Org:', org, 'VPN:', isVpn);
          const location = (response.data.loc || '').split(',');
          return {
            ip,
            city: response.data.city || 'Unknown',
            country: this.getCountryName(response.data.country) || 'Unknown',
            countryCode: response.data.country || 'XX',
            isp: org,
            vpn: isVpn,
            proxy: isVpn,
            hosting: isVpn,
            vpnInfo: isVpn ? 'VPN/Hosting detected by ISP name' : 'Regular ISP',
            region: response.data.region || 'Unknown',
            location: location.length === 2 ? { lat: location[0], lng: location[1] } : null
          };
        }
      } catch (error) {
        console.log('❌ ipinfo.io failed:', error.message);
      }

      // Enhanced fallback with basic geolocation based on IP ranges
      const fallbackData = this.getLocationFallback(ip);
      console.log('⚠️ Using fallback geolocation for', ip, ':', fallbackData);
      
      return {
        ip,
        ...fallbackData,
        isp: 'Unknown',
        vpn: false,
        vpnInfo: 'Geolocation services unavailable'
      };

    } catch (error) {
      console.error('❌ Critical error getting IP info:', error);
      return {
        ip,
        city: 'Error',
        country: 'Unknown',
        countryCode: 'XX',
        isp: 'Error',
        vpn: false,
        vpnInfo: 'Error detecting location'
      };
    }
  }

  // Check if ISP name indicates VPN/Proxy/Hosting
  checkIfVPN(org) {
    if (!org || typeof org !== 'string') return false;
    
    const vpnKeywords = [
      // VPN Services
      'vpn', 'proxy', 'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 
      'private internet access', 'pia', 'protonvpn', 'mullvad', 'windscribe',
      'tunnelbear', 'hotspot shield', 'ipvanish', 'purevpn', 'vyprvpn',
      'torguard', 'privatevpn', 'hide.me', 'zenmate', 'avast secureline',
      
      // Hosting/Cloud Providers
      'hosting', 'server', 'cloud', 'datacenter', 'data center',
      'digital ocean', 'digitalocean', 'amazon', 'aws', 'google cloud', 
      'microsoft azure', 'azure', 'linode', 'vultr', 'ovh', 'hetzner', 
      'contabo', 'cloudflare', 'akamai', 'fastly',
      
      // VPS/Dedicated
      'virtual private', 'dedicated server', 'vps', 'colocation', 'colo',
      'virtual server', 'virtual machine', 'vm hosting',
      
      // CDN/Infrastructure
      'cdn', 'content delivery', 'infrastructure', 'network solutions',
      
      // Proxy Services
      'anonymous', 'anonymizer', 'hide ip', 'mask ip', 'proxy service',
      
      // Common VPN/Proxy Indicators
      'tunnel', 'secure connection', 'privacy network', 'anonymous network'
    ];
    
    const orgLower = org.toLowerCase().trim();
    const isVpn = vpnKeywords.some(keyword => orgLower.includes(keyword));
    
    if (isVpn) {
      console.log(`🚨 VPN/Proxy detected in ISP name: "${org}"`);
    }
    
    return isVpn;
  }

  // Check if IP is private/internal
  isPrivateIP(ip) {
    if (!ip) return false;
    
    // IPv4 private ranges
    const privateRanges = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^127\./,
      /^169\.254\./,
      /^0\./
    ];
    
    return privateRanges.some(range => range.test(ip));
  }

  // Enhanced fallback geolocation based on IP ranges and common patterns
  getLocationFallback(ip) {
    if (!ip) {
      return { city: 'Unknown', country: 'Unknown', countryCode: 'XX' };
    }

    // Basic IP range to country mapping for major providers
    const ipRanges = [
      // US ranges (simplified examples)
      { pattern: /^(8|4)\./, location: { city: 'Mountain View', country: 'United States', countryCode: 'US' } },
      { pattern: /^74\./, location: { city: 'New York', country: 'United States', countryCode: 'US' } },
      { pattern: /^72\./, location: { city: 'Los Angeles', country: 'United States', countryCode: 'US' } },
      
      // European ranges
      { pattern: /^46\./, location: { city: 'London', country: 'United Kingdom', countryCode: 'GB' } },
      { pattern: /^31\./, location: { city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL' } },
      { pattern: /^84\./, location: { city: 'Frankfurt', country: 'Germany', countryCode: 'DE' } },
      
      // Asian ranges
      { pattern: /^122\./, location: { city: 'Tokyo', country: 'Japan', countryCode: 'JP' } },
      { pattern: /^61\./, location: { city: 'Sydney', country: 'Australia', countryCode: 'AU' } },
      { pattern: /^1\./, location: { city: 'Beijing', country: 'China', countryCode: 'CN' } }
    ];

    for (const range of ipRanges) {
      if (range.pattern.test(ip)) {
        return range.location;
      }
    }

    // If no pattern matches, make an educated guess based on first octet
    const firstOctet = parseInt(ip.split('.')[0]);
    
    if (firstOctet >= 1 && firstOctet <= 126) {
      return { city: 'Unknown', country: 'United States', countryCode: 'US' };
    } else if (firstOctet >= 128 && firstOctet <= 191) {
      return { city: 'Unknown', country: 'Europe', countryCode: 'EU' };
    } else if (firstOctet >= 192 && firstOctet <= 223) {
      return { city: 'Unknown', country: 'Asia', countryCode: 'AS' };
    }

    return { city: 'Unknown', country: 'Unknown', countryCode: 'XX' };
  }

  // Get full country name from country code
  getCountryName(countryCode) {
    const countryNames = {
      'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada',
      'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
      'ES': 'Spain', 'NL': 'Netherlands', 'BE': 'Belgium', 'CH': 'Switzerland',
      'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
      'JP': 'Japan', 'CN': 'China', 'KR': 'South Korea', 'IN': 'India',
      'SG': 'Singapore', 'HK': 'Hong Kong', 'TW': 'Taiwan', 'TH': 'Thailand',
      'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CL': 'Chile',
      'RU': 'Russia', 'PL': 'Poland', 'CZ': 'Czech Republic', 'HU': 'Hungary',
      'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya'
    };
    
    return countryNames[countryCode?.toUpperCase()] || countryCode;
  }

  // Get country flag emoji
  getCountryFlag(countryCode) {
    if (!countryCode || countryCode === 'XX') return '🌍';
    
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    
    return String.fromCodePoint(...codePoints);
  }
}

module.exports = new IPInfoService();
