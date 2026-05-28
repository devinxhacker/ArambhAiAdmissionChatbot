import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Inline translations — no HTTP backend needed, eliminates loading race conditions
const resources = {
  en: {
    translation: {
      chat: {
        welcome: "Welcome to Admission Chat",
        welcomeSubtitle: "Ask me anything about admissions, requirements, deadlines, and more.",
        inputPlaceholder: "Ask about admissions...",
        newChat: "New Chat",
      },
      auth: {
        login: "Sign In",
        loginDescription: "Enter your credentials to access the chat engine.",
        register: "Create Account",
        registerDescription: "Sign up to start using the admission assistant.",
        email: "Email",
        password: "Password",
        confirmPassword: "Confirm Password",
        name: "Full Name",
        forgotPassword: "Forgot password?",
        noAccount: "Don't have an account?",
        hasAccount: "Already have an account?",
      },
      nav: {
        chat: "Chat",
        upload: "Upload",
        admin: "Admin",
        profile: "Profile",
      },
    },
  },
  hi: {
    translation: {
      chat: {
        welcome: "एडमिशन चैट में आपका स्वागत है",
        welcomeSubtitle: "एडमिशन, आवश्यकताओं, डेडलाइन और अन्य किसी भी विषय पर पूछें।",
        inputPlaceholder: "एडमिशन के बारे में पूछें...",
        newChat: "नई चैट",
      },
      auth: {
        login: "साइन इन",
        loginDescription: "चैट इंजन तक पहुँचने के लिए अपने क्रेडेंशियल दर्ज करें।",
        register: "अकाउंट बनाएं",
        registerDescription: "एडमिशन असिस्टेंट का उपयोग शुरू करने के लिए साइन अप करें।",
        email: "ईमेल",
        password: "पासवर्ड",
        confirmPassword: "पासवर्ड की पुष्टि करें",
        name: "पूरा नाम",
        forgotPassword: "पासवर्ड भूल गए?",
        noAccount: "अकाउंट नहीं है?",
        hasAccount: "पहले से अकाउंट है?",
      },
      nav: {
        chat: "चैट",
        upload: "अपलोड",
        admin: "एडमिन",
        profile: "प्रोफ़ाइल",
      },
    },
  },
  mr: {
    translation: {
      chat: {
        welcome: "ॲडमिशन चॅटमध्ये आपले स्वागत आहे",
        welcomeSubtitle: "ॲडमिशन, आवश्यकता, डेडलाइन आणि इतर कोणत्याही विषयावर विचारा.",
        inputPlaceholder: "ॲडमिशनबद्दल विचारा...",
        newChat: "नवीन चॅट",
      },
      auth: {
        login: "साइन इन",
        loginDescription: "चॅट इंजिनमध्ये प्रवेश करण्यासाठी तुमचे क्रेडेंशियल प्रविष्ट करा.",
        register: "अकाउंट तयार करा",
        registerDescription: "ॲडमिशन असिस्टंट वापरण्यासाठी साइन अप करा.",
        email: "ईमेल",
        password: "पासवर्ड",
        confirmPassword: "पासवर्ड पुष्टी करा",
        name: "पूर्ण नाव",
        forgotPassword: "पासवर्ड विसरलात?",
        noAccount: "अकाउंट नाही?",
        hasAccount: "आधीच अकाउंट आहे?",
      },
      nav: {
        chat: "चॅट",
        upload: "अपलोड",
        admin: "ॲडमिन",
        profile: "प्रोफाइल",
      },
    },
  },
  ur: {
    translation: {
      chat: {
        welcome: "ایڈمیشن چیٹ میں خوش آمدید",
        welcomeSubtitle: "داخلے، ضروریات، ڈیڈ لائنز اور مزید کے بارے میں کچھ بھی پوچھیں۔",
        inputPlaceholder: "داخلے کے بارے میں پوچھیں...",
        newChat: "نئی چیٹ",
      },
      auth: {
        login: "سائن ان",
        loginDescription: "چیٹ انجن تک رسائی کے لیے اپنی اسناد درج کریں۔",
        register: "اکاؤنٹ بنائیں",
        registerDescription: "ایڈمیشن اسسٹنٹ استعمال شروع کرنے کے لیے سائن اپ کریں۔",
        email: "ای میل",
        password: "پاس ورڈ",
        confirmPassword: "پاس ورڈ کی تصدیق کریں",
        name: "پورا نام",
        forgotPassword: "پاس ورڈ بھول گئے؟",
        noAccount: "اکاؤنٹ نہیں ہے؟",
        hasAccount: "پہلے سے اکاؤنٹ ہے؟",
      },
      nav: {
        chat: "چیٹ",
        upload: "اپ لوڈ",
        admin: "ایڈمن",
        profile: "پروفائل",
      },
    },
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'mr', 'ur'],
    debug: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
