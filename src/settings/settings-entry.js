// npm packages
import DOMPurify from 'dompurify';
window.DOMPurify = DOMPurify;

// Shared modules (순서 유지 - window.* 전역 설정)
import '../shared/logger.js';
import '../shared/network-config.js';
import '../shared/network-access.js';
import '../shared/firebase-config.js';
import '../shared/firestore-db.js';
import '../shared/storage-manager.js';
import '../shared/sanitize.js';
import '../shared/toast.js';
import '../shared/theme.js';
import '../shared/cache-manager.js';

// MRL API (식품안전나라)
import '../shared/mrl-api.js';

// Main script
import './settings-script.js';
