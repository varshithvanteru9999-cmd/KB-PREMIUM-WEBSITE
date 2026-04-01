-- ============================================================
-- KB Beauty Salons — Service Translations Seed
-- Telugu (te) and Hindi (hi) for all 49 services
-- Uses service name lookup so it is safe to re-run (UPSERT)
-- ============================================================

-- Helper macro: insert both languages for one service
-- Pattern:
--   INSERT INTO service_translations ...
--   SELECT s.service_id, 'te'/'hi', what, why, how
--   FROM services s JOIN categories c ON s.category_id = c.category_id
--   WHERE s.name = '<name>'  [AND c.name = '<cat>' when name is not unique]
--   ON CONFLICT (service_id, lang_code) DO UPDATE SET ...


-- ─────────────────────────────────────────────────────────────
-- DE-TAN (10 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ ముఖంపై నల్లగా మారిన చర్మం మరియు సన్ టాన్‌ను తొలగించే చికిత్స.',
  'ఎండ వల్ల చర్మం నల్లగా మరియు అలసినట్లు కనిపిస్తుంది; డి-టాన్ మీ సహజమైన రంగును తిరిగి తెస్తుంది.',
  'మీ ముఖం నుండి టాన్ పొరను తొలగించే సురక్షితమైన క్లీనింగ్ క్రీమ్ అప్లై చేయడం ద్వారా.',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'De-Tan Face'
ON CONFLICT (service_id, lang_code) DO UPDATE SET
  description_what = EXCLUDED.description_what,
  description_why  = EXCLUDED.description_why,
  description_how  = EXCLUDED.description_how,
  updated_at       = NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके चेहरे से काले धब्बे और धूप की कालापन हटाने का उपचार।',
  'धूप से त्वचा काली और थकी हुई दिखती है; डी-टैन आपका प्राकृतिक रंग वापस लाता है।',
  'आपके चेहरे से टैन की परत हटाने वाली सुरक्षित क्लीनिंग क्रीम लगाकर।',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'De-Tan Face'
ON CONFLICT (service_id, lang_code) DO UPDATE SET
  description_what = EXCLUDED.description_what,
  description_why  = EXCLUDED.description_why,
  description_how  = EXCLUDED.description_how,
  updated_at       = NOW();

-- De-Tan Face & Neck
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ ముఖం మరియు మెడ రెండింటికీ పూర్తి టాన్ తొలగింపు.',
  'మీ మెడ రంగు మరియు ముఖ రంగు ఒకేలా మరియు ప్రకాశవంతంగా కనిపించేలా చేస్తుంది.',
  'చర్మంలో లోతుగా ఉన్న టాన్‌ను శుద్ధి చేసే ప్రత్యేక బ్రైటెనింగ్ పాక్‌లు అప్లై చేస్తాం.',
  NOW()
FROM services s WHERE s.name = 'De-Tan Face & Neck'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके चेहरे और गर्दन दोनों का पूरा टैन हटाना।',
  'इससे आपकी गर्दन और चेहरे का रंग एक जैसा और चमकदार दिखता है।',
  'हम विशेष ब्राइटनिंग पैक लगाते हैं जो त्वचा से गहरे टैन को साफ करते हैं।',
  NOW()
FROM services s WHERE s.name = 'De-Tan Face & Neck'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Under Arms
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ చంకల కింద నల్లగా మారిన చర్మానికి ప్రత్యేకమైన శుభ్రపరచడం.',
  'చెమట మరియు ఒరిపిడి వల్ల ఈ ప్రాంతం నల్లగా మారుతుంది; డి-టాన్ దాన్ని తిరిగి ప్రకాశవంతంగా చేస్తుంది.',
  'సున్నితమైన చర్మానికి తయారైన స్క్రబ్‌లు మరియు టాన్-రిమూవల్ క్రీమ్‌లు ఉపయోగించడం ద్వారా.',
  NOW()
FROM services s WHERE s.name = 'Under Arms'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपकी बगलों की काली पड़ी त्वचा के लिए विशेष सफाई।',
  'पसीने और घर्षण से यह क्षेत्र काला हो जाता है; डी-टैन इसे फिर से चमकाता है।',
  'संवेदनशील त्वचा के लिए बने हल्के स्क्रब और टैन-रिमूवल क्रीम का उपयोग करके।',
  NOW()
FROM services s WHERE s.name = 'Under Arms'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Feet De-Tan
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ పాదాల ప్రాంతం నుండి సన్ టాన్ మరియు మురికిని తొలగించడం.',
  'పాదాలు నేరుగా ఎండలో మరియు దుమ్ములో ఉంటాయి, అవి నల్లగా మరియు కఠినంగా మారతాయి.',
  'టాన్-రిమూవల్ పాక్ అప్లై చేయడానికి ముందు పాదాలను సేదతీర్చే ద్రావణంలో నానబెట్టడం.',
  NOW()
FROM services s WHERE s.name = 'Feet De-Tan'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके पैरों से धूप की कालापन और गंदगी हटाना।',
  'पैर सीधे धूप और धूल में रहते हैं, जिससे वे काले और खुरदुरे हो जाते हैं।',
  'टैन-रिमूवल पैक लगाने से पहले पैरों को सुकून देने वाले घोल में भिगोना।',
  NOW()
FROM services s WHERE s.name = 'Feet De-Tan'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Full Arms
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ పూర్తి చేతులకు సంపూర్ణ టాన్ తొలగింపు.',
  'చేతులు ఎక్కువగా ఎండలో ఉంటాయి మరియు సాధారణంగా అత్యధిక టాన్ పేరుకుంటుంది.',
  'డి-టాన్ క్రీమ్ పూర్తిగా అప్లై చేసిన తర్వాత నిపుణుల శుభ్రపరచడం.',
  NOW()
FROM services s WHERE s.name = 'Full Arms'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपकी पूरी भुजाओं का संपूर्ण टैन हटाना।',
  'भुजाएं सबसे ज्यादा धूप में रहती हैं और आमतौर पर सबसे ज्यादा टैन होती हैं।',
  'डी-टैन क्रीम पूरी तरह लगाने के बाद पेशेवर सफाई।',
  NOW()
FROM services s WHERE s.name = 'Full Arms'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Half Arms
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మోచేతుల వరకు మీ చేతులకు టాన్ తొలగింపు.',
  'మీ చేతులు పై భుజాల కంటే నల్లగా కనిపిస్తుంటే ఇది అనువైనది.',
  'మీ చేతుల బహిర్గతమైన భాగాలకు ఫోకస్ చేసిన డి-టాన్ చికిత్స.',
  NOW()
FROM services s WHERE s.name = 'Half Arms'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'कोहनी तक आपकी बाहों का टैन हटाना।',
  'परफेक्ट अगर आपके हाथ ऊपरी बाहों से ज्यादा काले दिखते हैं।',
  'आपकी बाहों के खुले हिस्सों पर केंद्रित डी-टैन उपचार।',
  NOW()
FROM services s WHERE s.name = 'Half Arms'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Half Legs
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మోకాళ్ళ వరకు మీ కాళ్ళకు శుభ్రపరచడం మరియు టాన్ తొలగింపు.',
  'చొట్లు లేదా సాండల్స్ వేసుకుని ఎండలో తిరగడం వల్ల కలిగిన టాన్‌ను తొలగిస్తుంది.',
  'మీ కాళ్ళ నుండి నల్లని చర్మాన్ని శుద్ధి చేయడానికి బలమైన డి-టాన్ పాక్ ఉపయోగిస్తాం.',
  NOW()
FROM services s WHERE s.name = 'Half Legs'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'घुटनों तक आपके पैरों की सफाई और टैन हटाना।',
  'शॉर्ट्स या सैंडल पहनकर धूप में घूमने से हुई कालापन हटाता है।',
  'हम आपके पैरों की काली त्वचा साफ करने के लिए मजबूत डी-टैन पैक का उपयोग करते हैं।',
  NOW()
FROM services s WHERE s.name = 'Half Legs'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Full Legs
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'సమస్త టాన్ మరియు నీరసాన్ని తొలగించడానికి పూర్తి కాళ్ళ చికిత్స.',
  'మీ పూర్తి కాళ్ళు ప్రకాశవంతంగా, శుభ్రంగా మరియు మృదువుగా కనిపిస్తాయి.',
  'మీ తొడల నుండి పాదాల వరకు టాన్-క్లియరింగ్ జెల్ అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Full Legs'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'पूरे टैन और सुस्ती को हटाने के लिए पूरे पैरों का उपचार।',
  'आपके पूरे पैर चमकदार, साफ और चिकने दिखेंगे।',
  'जांघों से पैरों तक टैन-क्लियरिंग जेल लगाना।',
  NOW()
FROM services s WHERE s.name = 'Full Legs'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Full Back & Front
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ పూర్తి వీపు మరియు ఛాతీ ప్రాంతానికి టాన్ తొలగింపు.',
  'బీచ్ ట్రిప్ తర్వాత లేదా ఎండలో బయటకి వెళ్ళిన తర్వాత శరీర రంగును సమానంగా చేయడానికి అనువైనది.',
  'పొత్తికడుపు ప్రాంతానికి సంపూర్ణ ఎక్స్‌ఫోలియేషన్ మరియు చల్లని డి-టాన్ పాక్‌లు.',
  NOW()
FROM services s WHERE s.name = 'Full Back & Front'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपकी पूरी पीठ और छाती के क्षेत्र का टैन हटाना।',
  'बीच ट्रिप के बाद या धूप में रहने के बाद शरीर का रंग समान करने के लिए आदर्श।',
  'धड़ के लिए पूर्ण एक्सफोलिएशन और ठंडे डी-टैन पैक।',
  NOW()
FROM services s WHERE s.name = 'Full Back & Front'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Full Body De-Tan
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'తలనుండి పాదాల వరకు టాన్ తొలగించడానికి సంపూర్ణ శరీర చికిత్స.',
  'మీ మొత్తం చర్మం నుండి సంవత్సరాల ఎండ నష్టం మరియు కాలుష్యాన్ని శుద్ధి చేస్తుంది.',
  'డి-టాన్ పాక్‌ల విలాసవంతమైన పూర్తి-శరీర అప్లికేషన్ మరియు నిపుణుల వాష్.',
  NOW()
FROM services s WHERE s.name = 'Full Body De-Tan'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सिर से पैर तक टैन हटाने के लिए पूरे शरीर का उपचार।',
  'आपकी पूरी त्वचा से वर्षों की धूप की क्षति और प्रदूषण को साफ करता है।',
  'डी-टैन पैक का शानदार पूरे शरीर पर अनुप्रयोग और पेशेवर धुलाई।',
  NOW()
FROM services s WHERE s.name = 'Full Body De-Tan'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- CLEAN UP (5 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'ఉపరితల మురికి మరియు నూనెను తొలగించే త్వరిత చర్మ శుభ్రపరచడం.',
  'రోజువారీ ధూళి చర్మ రంధ్రాలను మూసివేస్తుంది; శుభ్రపరచడం మొటిమలు మరియు నీరసాన్ని నివారిస్తుంది.',
  'సాధారణ శుభ్రపరచడం, తేలికైన స్క్రబ్, మరియు తాజా ముఖ కడగడం.',
  NOW()
FROM services s WHERE s.name = 'Face Cleansing'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सतह की गंदगी और तेल हटाने के लिए त्वरित त्वचा सफाई।',
  'रोज की धूल त्वचा के रोमछिद्र बंद करती है; सफाई मुंहासों और सुस्ती को रोकती है।',
  'सरल सफाई, हल्का स्क्रब, और ताजी फेस वॉश।',
  NOW()
FROM services s WHERE s.name = 'Face Cleansing'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ కణాలలోకి ఆక్సిజన్ పంపే ఒక ప్రీమియం చర్మ చికిత్స.',
  'ఇది లోతైన మురికి మరియు విషపదార్థాలను తొలగించి మీకు తక్షణ, ఆరోగ్యకరమైన మెరుపును ఇస్తుంది.',
  'నిపుణుల O3+ క్రీమ్‌లు మరియు ఆక్సిజన్ మాస్క్‌తో బహుళ-దశల ప్రక్రియ.',
  NOW()
FROM services s WHERE s.name = 'O3+ Clean Up'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'एक प्रीमियम स्किन ट्रीटमेंट जो आपकी कोशिकाओं में ऑक्सीजन पहुंचाती है।',
  'यह गहरी गंदगी और विषाक्त पदार्थ हटाकर आपको तुरंत स्वस्थ चमक देती है।',
  'प्रोफेशनल O3+ क्रीम और ऑक्सीजन मास्क के साथ बहु-चरणीय प्रक्रिया।',
  NOW()
FROM services s WHERE s.name = 'O3+ Clean Up'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'నూనె మరియు జిడ్డుగల చర్మం ఉన్న వ్యక్తులకు ప్రత్యేక శుభ్రపరచడం.',
  'అదనపు నూనె మొటిమలు మరియు బ్లాక్‌హెడ్‌లకు కారణమవుతుంది; ఈ చికిత్స నూనెను నియంత్రిస్తుంది.',
  'చర్మాన్ని పొడిగా చేయకుండా అదనపు నూనెను తొలగించే డీప్-పోర్ క్లీన్సర్‌లు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Classic Clean Up (Oily Skin)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'तैलीय और चिपचिपी त्वचा वाले लोगों के लिए विशेष सफाई।',
  'अतिरिक्त तेल मुंहासे और ब्लैकहेड्स का कारण बनता है; यह उपचार तेल को नियंत्रित करता है।',
  'गहरे-छिद्र क्लीन्ज़र का उपयोग करके जो त्वचा को रूखा किए बिना अतिरिक्त तेल हटाते हैं।',
  NOW()
FROM services s WHERE s.name = 'Classic Clean Up (Oily Skin)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'టాన్ తొలగింపు మరియు లోతైన రంధ్రాల శుభ్రపరచడం కలయిక.',
  'ఒకే సమయంలో సన్ టాన్ మరియు మురికి రెండింటిని తొలగించడానికి అత్యుత్తమం.',
  'రిఫ్రెషింగ్ స్కిన్ క్లీనింగ్ తర్వాత డి-టాన్ పాక్ అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'De-Tan Clean Up'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'टैन हटाने और गहरे रोमछिद्र सफाई का मिश्रण।',
  'एक साथ धूप की कालापन और गंदगी दोनों हटाने के लिए सर्वोत्तम।',
  'रिफ्रेशिंग स्किन क्लीनिंग के बाद डी-टैन पैक लगाना।',
  NOW()
FROM services s WHERE s.name = 'De-Tan Clean Up'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'చాలా తాజాగా మరియు ప్రకాశవంతంగా కనిపించడానికి మా అత్యుత్తమ శుభ్రపరిచే సేవ.',
  'చాలా తక్కువ సమయంలో పార్టీ లేదా ఈవెంట్‌కు మీరు సిద్ధంగా ఉన్నట్లు కనిపించేలా చేస్తుంది.',
  'మా అత్యుత్తమ చర్మ-బ్రైటెనింగ్ ఉత్పత్తులు ఉపయోగించి విలాసవంతమైన చికిత్స.',
  NOW()
FROM services s WHERE s.name = 'Signature Clean Up'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'बहुत ताजा और चमकदार दिखने के लिए हमारी सबसे अच्छी सफाई सेवा।',
  'बहुत कम समय में आपको पार्टी या इवेंट के लिए तैयार दिखाता है।',
  'हमारे सबसे अच्छे स्किन-ब्राइटनिंग उत्पादों का उपयोग करके शानदार उपचार।',
  NOW()
FROM services s WHERE s.name = 'Signature Clean Up'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- HAIR TREATMENT (4 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'రిలాక్సింగ్ స్కాల్ప్ మసాజ్ మరియు హెయిర్ కండీషనింగ్ చికిత్స.',
  'ఒత్తిడి మరియు కాలుష్యం జుట్టును పొడిగా చేస్తాయి; స్పా తేమను తిరిగి తెస్తుంది.',
  'హెయిర్ క్రీమ్‌తో లోతైన కండీషనింగ్ మరియు అది పీల్చుకోవడానికి స్టీమ్ సెషన్.',
  NOW()
FROM services s WHERE s.name = 'Classic Hair Spa'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'एक आरामदायक स्कैल्प मालिश और हेयर कंडीशनिंग उपचार।',
  'तनाव और प्रदूषण बालों को रूखा बनाते हैं; स्पा नमी वापस लाता है।',
  'हेयर क्रीम से गहरी कंडीशनिंग और इसे अंदर तक जाने के लिए स्टीम सेशन।',
  NOW()
FROM services s WHERE s.name = 'Classic Hair Spa'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'దెబ్బతిన్న జుట్టును మరమ్మతు చేయడానికి ప్రోటీన్-అధికమైన చికిత్స.',
  'జుట్టు ప్రోటీన్‌తో తయారవుతుంది; ఈ రీఫిల్ మీ జుట్టును బలంగా మరియు మృదువుగా చేస్తుంది.',
  'పగుళ్ళు మరమ్మతు చేయడానికి మరియు జుట్టు కమ్ముకోవడం తగ్గించడానికి లిక్విడ్ కెరటిన్ నింపడం.',
  NOW()
FROM services s WHERE s.name = 'Keratin Refill Hair Spa'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'क्षतिग्रस्त बालों की मरम्मत के लिए प्रोटीन-समृद्ध उपचार।',
  'बाल प्रोटीन से बने होते हैं; यह रिफिल आपके बालों को मजबूत और चिकना बनाता है।',
  'दरारें ठीक करने और बालों की घुंघराहट कम करने के लिए लिक्विड केराटिन भरना।',
  NOW()
FROM services s WHERE s.name = 'Keratin Refill Hair Spa'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ జుట్టు వేళ్ళను బలంగా చేయడంపై దృష్టి పెట్టిన చికిత్స.',
  'స్కాల్ప్‌కు పోషణ అందించడం ద్వారా జుట్టు విరగడం మరియు రాలడం ఆపుతుంది.',
  'వేళ్ళకు రక్త ప్రవాహం మెరుగుపరచడానికి ప్రత్యేక సీరమ్‌లు మరియు మసాజ్ ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Anti Hair Fall'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके बालों की जड़ों को मजबूत बनाने पर केंद्रित उपचार।',
  'स्कैल्प को पोषण देकर बालों को टूटने और झड़ने से रोकता है।',
  'जड़ों तक रक्त प्रवाह सुधारने के लिए विशेष सीरम और मालिश का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Anti Hair Fall'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'చికాకు కలిగించే పొలుసులను తొలగించడానికి స్కాల్ప్-శుభ్రపరిచే చికిత్స.',
  'చిప్ప ఫంగస్ లేదా పొడి స్కాల్ప్ వల్ల వస్తుంది; ఈ స్పా దాన్ని శుద్ధి చేసి తగ్గిస్తుంది.',
  'యాంటీ-ఫంగల్ జెల్‌లు అప్లై చేసి మీ స్కాల్ప్‌ను పూర్తిగా శుభ్రపరచడం.',
  NOW()
FROM services s WHERE s.name = 'Anti Dandruff Hair Spa'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'खुजलीदार रूसी को हटाने के लिए स्कैल्प-सफाई उपचार।',
  'रूसी फफूंद या रूखी स्कैल्प से होती है; यह स्पा इसे दूर करके राहत देता है।',
  'एंटी-फंगल जेल लगाकर और आपकी स्कैल्प को अच्छी तरह साफ करना।',
  NOW()
FROM services s WHERE s.name = 'Anti Dandruff Hair Spa'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- HEAD OIL MASSAGE (2 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'వెచ్చని నూనెతో రిలాక్సింగ్ మసాజ్ తర్వాత హెయిర్ వాష్.',
  'ఒత్తిడిని తగ్గిస్తుంది, నిద్రను మెరుగుపరుస్తుంది మరియు స్కాల్ప్‌ను ఆరోగ్యంగా ఉంచుతుంది.',
  'అధిక నాణ్యత గల నూనెతో 15-20 నిమిషాల సున్నితమైన తల మసాజ్.',
  NOW()
FROM services s WHERE s.name = 'Head Oil Massage (Including Wash)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'गर्म तेल से आरामदायक मालिश और उसके बाद बाल धोना।',
  'तनाव दूर करता है, नींद सुधारता है और स्कैल्प को स्वस्थ रखता है।',
  'उच्च गुणवत्ता वाले तेल से 15-20 मिनट की हल्की सिर की मालिश।',
  NOW()
FROM services s WHERE s.name = 'Head Oil Massage (Including Wash)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'తాజా మింట్ ఆయిల్ ఉపయోగించి చల్లని మసాజ్ మరియు హెయిర్ వాష్.',
  'మింట్ చాలా చల్లనిగా మరియు తాజాగా అనిపింపజేస్తుంది, వేడి రోజులకు అనువైనది.',
  'మీ మనసును రిలాక్స్ చేసే మరియు స్కాల్ప్‌ను రిఫ్రెష్ చేసే చల్లని మింట్ ఆయిల్ ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Mint Oil Head Massage (Including Wash)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'ताजे पुदीने के तेल से ठंडी मालिश और बाल धोना।',
  'पुदीना बहुत ठंडा और ताजा एहसास देता है, गर्म दिनों के लिए बिल्कुल सही।',
  'ठंडे पुदीने के तेल का उपयोग जो मन को शांत करता है और स्कैल्प को तरोताजा करता है।',
  NOW()
FROM services s WHERE s.name = 'Mint Oil Head Massage (Including Wash)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- HAIR COLOURINGS (5 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'సాధారణ రంగు ఉపయోగించి వేళ్ళ దగ్గర నెరిసిన జుట్టును కప్పడం.',
  'నెరిసిన వేళ్ళను దాచి మీ జుట్టు సహజంగా నల్లగా లేదా రంగులో కనిపించేలా చేస్తుంది.',
  'స్కాల్ప్ దగ్గర కొత్తగా పెరిగిన జుట్టుకు మాత్రమే రంగు అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Root Touchup (Ammonia)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सामान्य रंग का उपयोग करके जड़ों पर सफेद बाल छुपाना।',
  'सफेद जड़ें छुपाकर आपके बाल प्राकृतिक रूप से काले या रंगीन दिखते हैं।',
  'स्कैल्प के पास नए उगे बालों पर ही रंग लगाना।',
  NOW()
FROM services s WHERE s.name = 'Root Touchup (Ammonia)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'సురక్షితమైన, కెమికల్-రహిత రంగు ఉపయోగించి నెరిసిన వేళ్ళను కప్పడం.',
  'సున్నితమైన స్కాల్ప్‌లు ఉన్న వ్యక్తులకు లేదా కఠినమైన రసాయనాలను నివారించాలనుకునే వారికి అత్యుత్తమం.',
  'అమ్మోనియా-రహిత హెయిర్ కలర్ ఉపయోగించడం, ఇది సున్నితంగా ఉంటుంది కానీ చాలా కాలం ఉంటుంది.',
  NOW()
FROM services s WHERE s.name = 'Root Touchup (Ammonia Free)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सुरक्षित, रसायन-मुक्त रंग का उपयोग करके सफेद जड़ें छुपाना।',
  'संवेदनशील स्कैल्प वाले लोगों या कठोर रसायनों से बचना चाहने वालों के लिए सर्वोत्तम।',
  'अमोनिया-मुक्त हेयर कलर का उपयोग जो कोमल है लेकिन लंबे समय तक टिकता है।',
  NOW()
FROM services s WHERE s.name = 'Root Touchup (Ammonia Free)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'ఒక హెయిర్ స్ట్రిప్‌కు బ్రైట్ ఫ్యాషన్ కలర్ వేయడం.',
  'స్టైలిష్‌గా కనిపించడానికి నీలం, ఎరుపు లేదా ఊదా వంటి రంగులు జోడించండి.',
  'జుట్టు యొక్క చిన్న భాగాన్ని బ్లీచ్ చేసి ఫ్యాషన్ షేడ్ అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Fashion Colour Per Streak'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'बालों की एक पट्टी पर चमकीला फैशन रंग लगाना।',
  'नीले, लाल या बैंगनी जैसे रंग जोड़कर स्टाइलिश दिखें।',
  'बालों के एक छोटे हिस्से को ब्लीच करके फैशन शेड लगाना।',
  NOW()
FROM services s WHERE s.name = 'Fashion Colour Per Streak'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'సురక్షితమైన, నాన్-కెమికల్ రంగుతో మీ మొత్తం జుట్టుకు రంగు వేయడం.',
  'మీ జుట్టును ఆరోగ్యంగా మరియు సురక్షితంగా ఉంచుతూ మీ మొత్తం రూపాన్ని మారుస్తుంది.',
  'పైనుండి కింది వరకు జుట్టు యొక్క ప్రతి స్ట్రాండ్‌కు సున్నితమైన రంగు అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Ammonia Free Global'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सुरक्षित, गैर-रासायनिक रंग से पूरे बालों को रंगना।',
  'बालों को स्वस्थ और सुरक्षित रखते हुए पूरी लुक बदलता है।',
  'ऊपर से नीचे तक बालों के हर धागे पर कोमल रंग लगाना।',
  NOW()
FROM services s WHERE s.name = 'Ammonia Free Global'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ మొత్తం జుట్టుకు స్టైలిష్ ఫ్యాషన్ కలర్ అప్లై చేయడం.',
  'ఆధునికమైన మరియు ట్రెండీ రూపంలోకి సంపూర్ణ మార్పు కోసం.',
  'జుట్టు తేలికగా చేసి నిపుణుల రంగు అప్లై చేసే పూర్తి ప్రక్రియ.',
  NOW()
FROM services s WHERE s.name = 'Global Fashion Colour'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'पूरे बालों पर स्टाइलिश फैशन रंग लगाना।',
  'एक आधुनिक और ट्रेंडी लुक में पूरा परिवर्तन के लिए।',
  'बालों को हल्का करने और प्रोफेशनल रंग लगाने की पूरी प्रक्रिया।',
  NOW()
FROM services s WHERE s.name = 'Global Fashion Colour'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- MAKE UP (3 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'పరిపూర్ణ రూపం కోసం హీట్ టూల్స్ ఉపయోగించి నిపుణుల స్టైలింగ్.',
  'పెళ్ళిళ్ళు, పార్టీలు లేదా ప్రత్యేక సందర్భాల కోసం మీరు సిద్ధంగా ఉన్నట్లు కనిపించేలా చేస్తుంది.',
  'బ్లో డ్రయర్లు, ఇస్త్రీలు మరియు మీ జుట్టును స్థానంలో ఉంచే స్ప్రేలు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Hair Styling'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'परफेक्ट लुक के लिए हीट टूल्स से प्रोफेशनल स्टाइलिंग।',
  'आपको शादियों, पार्टियों या खास आयोजनों के लिए तैयार दिखाता है।',
  'ब्लो ड्रायर, आयरन और बालों को जगह पर रखने वाले स्प्रे का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Hair Styling'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'వివాహ దినాన వరుల కోసం సహజమైన మేకప్ రూపం.',
  'ఫొటోలలో బరువుగా కనిపించకుండా తాజాగా మరియు ఏకసమానంగా కనిపించేలా సహాయపడుతుంది.',
  'చిన్న లోపాలను దాచడానికి బేసిక్ ఫౌండేషన్ మరియు పౌడర్ అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Groom Make Up (Classic)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'शादी के दिन दूल्हे के लिए एक प्राकृतिक मेकअप लुक।',
  'फ़ोटो में भारी दिखे बिना ताजा और एकसमान दिखने में मदद करता है।',
  'छोटी खामियां छुपाने के लिए बेसिक फाउंडेशन और पाउडर लगाना।',
  NOW()
FROM services s WHERE s.name = 'Groom Make Up (Classic)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'HD కెమెరాలలో పరిపూర్ణంగా కనిపించే అత్యుత్తమ మేకప్.',
  'ఇది చెమట-నిరోధకంగా ఉంటుంది, రోజంతా ఉంటుంది మరియు వాస్తవ జీవితంలో చాలా సహజంగా కనిపిస్తుంది.',
  'ప్రత్యేక హై-డెఫినిషన్ ఉత్పత్తులు లేదా స్ప్రే-మేకప్ టూల్ ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Groom Make Up (HD & Air Brush)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'HD कैमरों पर परफेक्ट दिखने वाला सबसे अच्छा मेकअप।',
  'यह पसीना-रोधी है, पूरे दिन टिकता है और वास्तविक जीवन में बहुत प्राकृतिक दिखता है।',
  'विशेष हाई-डेफिनिशन उत्पादों या स्प्रे-मेकअप टूल का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Groom Make Up (HD & Air Brush)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- PEDICURE (6 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ అలసిన పాదాలకు 20-నిమిషాల రిలాక్సింగ్ మసాజ్.',
  'రక్త ప్రవాహాన్ని మెరుగుపరుస్తుంది మరియు ఒక పొడవైన రోజు తర్వాత పాదాల నొప్పిని తగ్గిస్తుంది.',
  'సుగంధ నూనెలు ఉపయోగించి మీ పాదాలపై ఫోకస్ చేసిన ఒత్తిడి మరియు మసాజ్.',
  NOW()
FROM services s WHERE s.name = 'Foot Massage'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके थके हुए पैरों के लिए 20 मिनट की आरामदायक मालिश।',
  'रक्त प्रवाह में मदद करता है और लंबे दिन के बाद पैर दर्द कम करता है।',
  'सुगंधित तेलों का उपयोग करके आपके पैरों पर केंद्रित दबाव और मालिश।',
  NOW()
FROM services s WHERE s.name = 'Foot Massage'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'పాదాలకు బేసిక్ శుభ్రపరచడం మరియు గోరు ఆకారం ఇవ్వడం.',
  'మీ పాదాలను శుభ్రంగా ఉంచుతుంది మరియు లోపలికి పెరిగే గోళ్ళు లేదా సంక్రమణాలను నివారిస్తుంది.',
  'పాదాలను నానబెట్టడం, గోళ్ళు శుభ్రపరచడం మరియు చనిపోయిన చర్మాన్ని తొలగించడం.',
  NOW()
FROM services s WHERE s.name = 'Classic Pedicure (No Leg Massage)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'पैरों के लिए बेसिक सफाई और नाखून आकार देना।',
  'पैरों को साफ रखता है और अंदर की ओर बढ़ने वाले नाखूनों या संक्रमण को रोकता है।',
  'पैर भिगोना, नाखून साफ करना और मृत त्वचा हटाना।',
  NOW()
FROM services s WHERE s.name = 'Classic Pedicure (No Leg Massage)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'చర్మ మార్దవత చేయడం మరియు మసాజ్‌తో విలాసవంతమైన ఫుట్ స్పా.',
  'మీ పాదాలను అసాధారణంగా మృదువుగా మరియు చాలా శుభ్రంగా కనిపించేలా చేస్తుంది.',
  'ప్రత్యేకమైన లవణాలు, స్క్రబ్‌లు మరియు అధికమైన తేమ ఇచ్చే మాస్క్ ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Exotic Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'त्वचा को नरम करने और मालिश के साथ विलासितापूर्ण फुट स्पा।',
  'आपके पैरों को अविश्वसनीय रूप से मुलायम और बहुत साफ दिखाता है।',
  'विशेष नमक, स्क्रब और एक समृद्ध मॉइस्चराइजिंग मास्क का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Exotic Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'O3+ స్కిన్ బ్రైటెనింగ్ ఉత్పత్తులు ఉపయోగించి హై-ఎండ్ పెడిక్యూర్.',
  'ప్రకాశవంతమైన రూపం కోసం మీ పాదాల నుండి లోతైన మురికి మరియు టాన్‌ను తొలగిస్తుంది.',
  'O3+ క్రీమ్‌లు మరియు బ్రైటెనింగ్ ఫుట్ పాక్‌తో నిపుణుల ప్రక్రియ.',
  NOW()
FROM services s WHERE s.name = 'O3+ Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'O3+ स्किन ब्राइटनिंग उत्पादों का उपयोग करके हाई-एंड पेडीक्योर।',
  'चमकदार लुक के लिए पैरों से गहरी गंदगी और टैन हटाता है।',
  'O3+ क्रीम और ब्राइटनिंग फुट पैक के साथ पेशेवर प्रक्रिया।',
  NOW()
FROM services s WHERE s.name = 'O3+ Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'ఐస్ క్రీమ్ ఉత్పత్తులు ఉపయోగించి ఒక సరదా మరియు చాలా తేమ ఇచ్చే చికిత్స.',
  'క్రీమీ ఉత్పత్తులు మరే పెడిక్యూర్ కంటే లోతైన హైడ్రేషన్ అందిస్తాయి.',
  '"ఐస్ క్రీమ్" ఆకారపు స్క్రబ్‌లు మరియు బటర్-ఆధారిత తేమ ఇచ్చే క్రీమ్‌లు ఉపయోగించడం.',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'ICE Cream Pedicure' AND c.name = 'Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आइस क्रीम उत्पादों का उपयोग करके एक मजेदार और बेहद मॉइस्चराइजिंग उपचार।',
  'क्रीमी उत्पाद किसी भी अन्य पेडीक्योर की तुलना में गहरी नमी प्रदान करते हैं।',
  '"आइस क्रीम" आकार के स्क्रब और मक्खन-आधारित मॉइस्चराइजिंग क्रीम का उपयोग।',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'ICE Cream Pedicure' AND c.name = 'Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Kanpeki (Pedicure category)
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'అత్యంత చర్మ మార్దవత కోసం ఒక ప్రీమియం జపనీస్ చికిత్స.',
  'చాలా పొడి చర్మం ఉన్న వ్యక్తులకు అత్యుత్తమం, విలాస అనుభవం కోసం.',
  'పాదాలను మరమ్మతు చేయడానికి మరియు హైడ్రేట్ చేయడానికి హై-ఎండ్ జపనీస్ కన్పేకి ఉత్పత్తులు ఉపయోగించడం.',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'Kanpeki Manicure' AND c.name = 'Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'अत्यधिक त्वचा कोमलता के लिए एक प्रीमियम जापानी उपचार।',
  'बहुत रूखी त्वचा वाले लोगों के लिए सर्वोत्तम जो विलास अनुभव चाहते हैं।',
  'पैरों की मरम्मत और हाइड्रेट करने के लिए हाई-एंड जापानी कानपेकी उत्पादों का उपयोग।',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'Kanpeki Manicure' AND c.name = 'Pedicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- MANICURE (5 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ చేతులు మరియు గోళ్ళకు బేసిక్ శుభ్రపరచడం మరియు గ్రూమింగ్.',
  'మీ చేతులు చక్కగా, శుభ్రంగా మరియు నిపుణులుగా కనిపించేలా ఉంచుతుంది.',
  'తేలికపాటి మసాజ్‌తో గోరు కత్తిరించడం, ఆకారం ఇవ్వడం మరియు బేసిక్ శుభ్రపరచడం.',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'Classic Manicure' AND c.name = 'Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके हाथों और नाखूनों की बेसिक सफाई और ग्रूमिंग।',
  'आपके हाथों को साफ, सुघड़ और पेशेवर दिखाता है।',
  'हल्की मालिश के साथ नाखून काटना, आकार देना और बेसिक सफाई।',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'Classic Manicure' AND c.name = 'Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'విలాసవంతమైన అనుభవంతో చేతులకు మార్దవత చికిత్స.',
  'అదనపు శ్రద్ధ మరియు తేమ అవసరమయ్యే చాలా పొడి చేతులకు అనువైనది.',
  'చేతులకు సుగంధ నూనెలు మరియు అధికమైన తేమ ఇచ్చే మాస్క్ ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Exotic Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'विलासितापूर्ण अनुभव के साथ हाथों को नरम करने का उपचार।',
  'बहुत रूखे हाथों के लिए जिन्हें अतिरिक्त देखभाल और नमी की आवश्यकता है।',
  'हाथों के लिए सुगंधित तेलों और एक समृद्ध मॉइस्चराइजिंग मास्क का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Exotic Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'O3+ ఉత్పత్తులు ఉపయోగించి చేతులకు బ్రైటెనింగ్ చికిత్స.',
  'చేతుల నుండి సన్ టాన్‌ను తొలగించి యవ్వనంగా కనిపించేలా చేస్తుంది.',
  'నిపుణుల O3+ శుభ్రపరచడం తర్వాత బ్రైటెనింగ్ సీరమ్.',
  NOW()
FROM services s WHERE s.name = 'O3+ Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'O3+ उत्पादों का उपयोग करके हाथों के लिए ब्राइटनिंग उपचार।',
  'हाथों से धूप की कालापन हटाकर उन्हें युवा दिखाता है।',
  'प्रोफेशनल O3+ सफाई के बाद ब्राइटनिंग सीरम।',
  NOW()
FROM services s WHERE s.name = 'O3+ Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'తీయని సుగంధాలతో చేతులకు లోతైన తేమ ఇచ్చే చికిత్స.',
  'మీ చేతులు చాలా రోజులు అద్భుతంగా వాసన కలిగి మరియు సిల్క్ లాగా అనిపించేలా చేస్తుంది.',
  'ఐస్ క్రీమ్ రుచులతో ప్రేరణ పొందిన బటర్-అధికమైన క్రీమ్‌లు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'ICE Cream Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'मीठी सुगंध के साथ हाथों के लिए गहरा मॉइस्चराइजिंग उपचार।',
  'आपके हाथों को दिनों तक बेहतरीन महकाता है और रेशम की तरह महसूस कराता है।',
  'आइस क्रीम के स्वाद से प्रेरित मक्खन-युक्त क्रीम का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'ICE Cream Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- Kanpeki (Manicure category)
INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'అత్యంత అందమైన చేతులకు విలాసవంతమైన జపనీస్ చికిత్స.',
  'మీ చేతులు మరియు చేతి చర్మాన్ని లోతుగా మరమ్మతు చేస్తుంది మరియు పునరుజ్జీవింపజేస్తుంది.',
  'జపనీస్ కన్పేకి స్కిన్ కేర్ ఉత్పత్తులు ఉపయోగించి హై-ఎండ్ ప్రక్రియ.',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'Kanpeki Manicure' AND c.name = 'Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सबसे सुंदर हाथों के लिए शानदार जापानी उपचार।',
  'आपके हाथों और बाहों की त्वचा को गहराई से ठीक और पुनर्जीवित करता है।',
  'जापानी कानपेकी स्किन केयर उत्पादों का उपयोग करके हाई-एंड प्रक्रिया।',
  NOW()
FROM services s JOIN categories c ON s.category_id = c.category_id
WHERE s.name = 'Kanpeki Manicure' AND c.name = 'Manicure'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- HAIRCUT (3 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీ ముఖ ఆకారానికి ప్రత్యేకంగా రూపొందించిన నిపుణుల హెయిర్‌కట్.',
  'మంచి హెయిర్‌కట్ మీ ముఖ వైశిష్ట్యాలను మెరుగుపరుస్తుంది మరియు మీరు చురుగ్గా కనిపించేలా చేస్తుంది.',
  'మీకు దీర్ఘకాలం ఉండే స్టైల్ ఇవ్వడానికి పదునైన పరికరాలు మరియు నిపుణుల విభజన ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Hair Cut'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'आपके चेहरे के आकार के लिए विशेष रूप से डिज़ाइन किया गया पेशेवर हेयरकट।',
  'एक अच्छा हेयरकट आपकी चेहरे की विशेषताओं को बेहतर बनाता है और आपको शार्प दिखाता है।',
  'आपको लंबे समय तक टिकने वाला स्टाइल देने के लिए तेज टूल्स और एक्सपर्ट सेक्शनिंग।',
  NOW()
FROM services s WHERE s.name = 'Hair Cut'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'విలాస ఉత్పత్తులు ఉపయోగించి జుట్టు యొక్క లోతైన శుభ్రపరచడం మరియు మృదువుగా చేయడం.',
  'కడగడం నూనె మరియు మురికిని తొలగిస్తుంది, కండీషనర్ జుట్టు నష్టం నుండి రక్షిస్తుంది.',
  'తేమ ఇచ్చే మాస్క్ తర్వాత స్కాల్ప్ మసాజ్‌తో వరుసగా షాంపూ అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Hair Wash And Conditioning'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'लक्जरी उत्पादों का उपयोग करके बालों की गहरी सफाई और मुलायम बनाना।',
  'धोने से तेल और गंदगी हटती है, जबकि कंडीशनर बालों को नुकसान से बचाता है।',
  'हाइड्रेटिंग मास्क के बाद स्कैल्प मालिश के साथ चरण-दर-चरण शैम्पू।',
  NOW()
FROM services s WHERE s.name = 'Hair Wash And Conditioning'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'శుభ్రమైన రూపం కోసం మీ జుట్టును తాత్కాలికంగా స్టైల్ చేయడం.',
  'మీకు మీటింగ్ లేదా త్వరిత ఈవెంట్ ఉంటే అనువైనది.',
  'మీ జుట్టును స్థానంలో ఉంచడానికి బ్లో డ్రయర్లు మరియు స్టైలింగ్ జెల్‌లు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Hair Setting'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'साफ लुक के लिए आपके बालों को अस्थायी रूप से स्टाइल करना।',
  'परफेक्ट अगर आपके पास कोई मीटिंग या त्वरित इवेंट है।',
  'बालों को जगह पर रखने के लिए ब्लो ड्रायर और स्टाइलिंग जेल का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Hair Setting'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- KIDS (2 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'పిల్లలకు సున్నితమైన మరియు త్వరిత హెయిర్‌కట్.',
  'పిల్లలను సౌకర్యంగా ఉంచుతూ వారికి తెలివైన మరియు చక్కని రూపం ఇవ్వడం.',
  'సురక్షితమైన అనుభవం కోసం పిల్లలకు అనుకూలమైన పరికరాలు మరియు పద్ధతులు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Kids Hair Cut (Under 10)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'बच्चों के लिए एक कोमल और त्वरित हेयरकट।',
  'बच्चों को आरामदायक रखते हुए उन्हें स्मार्ट और साफ-सुथरा लुक देना।',
  'सुरक्षित अनुभव के लिए बच्चों के अनुकूल टूल्स और तकनीकों का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Kids Hair Cut (Under 10)'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'పిల్లల సున్నితమైన జుట్టుకు మృదువైన శుభ్రపరచడం.',
  'ఏ కన్నీళ్ళు లేదా చికాకు లేకుండా స్కాల్ప్‌ను సున్నితంగా శుభ్రపరుస్తుంది.',
  'పిల్లలకు ప్రత్యేకంగా తయారైన చాలా తేలికైన షాంపూలు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Kids Hair Wash & Conditioning'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'बच्चे के नाजुक बालों के लिए एक कोमल सफाई।',
  'बिना किसी आंसू या जलन के स्कैल्प को धीरे से साफ करता है।',
  'बच्चों के लिए विशेष रूप से बने बहुत हल्के शैम्पू का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Kids Hair Wash & Conditioning'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();


-- ─────────────────────────────────────────────────────────────
-- BEARD (4 services)
-- ─────────────────────────────────────────────────────────────

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'యువంగా కనిపించడానికి గడ్డంలో నెరిసిన జుట్టు కప్పడం.',
  'మీ గడ్డం ఏకరీతిగా మరియు చక్కగా నిర్వహించబడినట్లు కనిపించేలా ఉంచుతుంది.',
  'మీ సహజ జుట్టు షేడ్‌కు సరిపోయే సురక్షితమైన గడ్డం రంగు అప్లై చేయడం.',
  NOW()
FROM services s WHERE s.name = 'Beard Colouring'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'जवान दिखने के लिए दाढ़ी के सफेद बाल छुपाना।',
  'आपकी दाढ़ी को एकसमान और अच्छी तरह से तैयार दिखाता है।',
  'आपके प्राकृतिक बालों के रंग से मेल खाने वाला सुरक्षित दाढ़ी रंग लगाना।',
  NOW()
FROM services s WHERE s.name = 'Beard Colouring'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'చక్కని రూపం కోసం మీ గడ్డం ఆకారంలో మరియు కత్తిరించడం.',
  'చక్కగా ట్రిమ్ చేసిన గడ్డం మీ దవడ రేఖను నిర్వచిస్తుంది మరియు నిపుణులుగా కనిపిస్తుంది.',
  'మీకు సరైన గడ్డం ఆకారం ఇవ్వడానికి నిపుణుల పరికరాలు ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Beard Trimming'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'साफ दिखने के लिए आपकी दाढ़ी को आकार देना और काटना।',
  'अच्छी तरह ट्रिम की गई दाढ़ी आपकी जबड़े की रेखा को परिभाषित करती है और पेशेवर दिखती है।',
  'आपको परफेक्ट दाढ़ी का आकार देने के लिए प्रोफेशनल टूल्स का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Beard Trimming'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'సింగిల్ బ్లేడ్ ఉపయోగించి ముఖంపై అన్ని జుట్టు తొలగించే శుభ్రమైన షేవ్.',
  'చాలా తాజాగా అనిపించడానికి అన్ని ముఖ జుట్టు మరియు మృత చర్మాన్ని తొలగిస్తుంది.',
  'సౌకర్యవంతమైన షేవ్ కోసం వేడి టవల్స్ మరియు అధికమైన ఫోమ్ ఉపయోగించడం.',
  NOW()
FROM services s WHERE s.name = 'Shave'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'सिंगल ब्लेड का उपयोग करके एक साफ और चिकना चेहरा शेव।',
  'बहुत ताजा महसूस कराने के लिए सभी चेहरे के बाल और मृत त्वचा हटाता है।',
  'आरामदायक शेव के लिए गर्म तौलिये और समृद्ध फोम का उपयोग।',
  NOW()
FROM services s WHERE s.name = 'Shave'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'te',
  'మీసాల నుండి నెరిసిన జుట్టు ఖచ్చితంగా కప్పడం.',
  'మీ ముఖ జుట్టు యవ్వనంగా మరియు నల్లగా కనిపించేలా ఉంచడంలో సహాయపడుతుంది.',
  'మీసాల ప్రాంతానికి మాత్రమే ఖచ్చితమైన రంగు వేయడం.',
  NOW()
FROM services s WHERE s.name = 'Mustache Coloring'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

INSERT INTO service_translations (service_id, lang_code, description_what, description_why, description_how, updated_at)
SELECT s.service_id, 'hi',
  'मूंछों पर सफेद बालों को सटीकता से छुपाना।',
  'आपके चेहरे के बालों को जवान और काला दिखाने में मदद करता है।',
  'केवल मूंछों के क्षेत्र के लिए सटीक रंग।',
  NOW()
FROM services s WHERE s.name = 'Mustache Coloring'
ON CONFLICT (service_id, lang_code) DO UPDATE SET description_what=EXCLUDED.description_what, description_why=EXCLUDED.description_why, description_how=EXCLUDED.description_how, updated_at=NOW();

-- ============================================================
-- END OF SEED
-- Total: 49 services × 2 languages = 98 translation rows
-- ============================================================
