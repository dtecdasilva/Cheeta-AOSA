/**
 * The French wording of every seeded template, by the English template's
 * code. Each becomes its own template (code + "-FR", language "fr"), so
 * administration can edit, activate or retire the French and the English
 * separately. Drafted for review by a native speaker.
 */
export const FR_SEED_WORDING: Record<string, { name: string; subject: string; body: string }> = {
  "REG-WELCOME-EMAIL": {
    name: "Bienvenue et identifiants de connexion",
    subject: "Vos identifiants de connexion {{platform.name}}",
    body: "Bonjour {{student.firstName}},\n\nVotre compte sur {{platform.name}} est prêt.\n\nE-mail : {{student.email}}\nCode de connexion temporaire : {{login.code}}\n\nConnectez-vous sur {{portal.url}} en utilisant ce code comme mot de passe. Il vous sera demandé d'en choisir un nouveau.\n\nL'équipe {{platform.name}}",
  },
  "REG-WELCOME-SMS": {
    name: "SMS de bienvenue",
    subject: "",
    body: "{{platform.name}} : votre compte est prêt. Consultez {{student.email}} pour vos identifiants de connexion.",
  },
  "REG-RESET-EMAIL": {
    name: "Réinitialisation du mot de passe",
    subject: "Réinitialisez votre mot de passe {{platform.name}}",
    body: "Bonjour {{student.firstName}},\n\nUne demande de réinitialisation du mot de passe a été faite pour {{student.email}}. Ouvrez ce lien pour en choisir un nouveau :\n\n{{reset.url}}\n\nLe lien expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail. Votre mot de passe ne changera pas.",
  },
  "REG-VERIFY-EMAIL": {
    name: "Confirmation de l'adresse e-mail",
    subject: "Confirmez votre adresse e-mail pour {{platform.name}}",
    body: "Bonjour {{student.firstName}},\n\nOuvrez ce lien pour confirmer votre adresse e-mail sur {{platform.name}} :\n\n{{verify.url}}\n\nLe lien est valable 48 heures. Si vous ne vous êtes pas inscrit, ignorez ce message.",
  },
  "APP-SUBMITTED-EMAIL": {
    name: "Candidature soumise",
    subject: "Candidature {{application.reference}} soumise à {{institution.name}}",
    body: "Bonjour {{student.firstName}},\n\nVotre candidature {{application.reference}} pour {{application.program}} a été soumise à {{institution.name}}.\n\nNous vous informerons dès que l'établissement l'aura prise en compte. Vous pouvez suivre son avancement sur {{portal.url}}.",
  },
  "APP-SUBMITTED-INAPP": {
    name: "Candidature soumise (dans l'application)",
    subject: "Candidature soumise à {{institution.name}}",
    body: "Votre candidature {{application.reference}} pour {{application.program}} a été soumise. Nous vous préviendrons dès que {{institution.name}} l'aura prise en compte.",
  },
  "APP-DEADLINE-SMS": {
    name: "SMS de rappel de date limite",
    subject: "",
    body: "{{platform.name}} : les candidatures pour {{academicYear}} ferment le {{deadline}}. Ajoutez vos établissements et payez vos frais avant cette date.",
  },
  "PAY-RECEIVED-EMAIL": {
    name: "Reçu de paiement des frais",
    subject: "Paiement reçu : {{payment.amount}}",
    body: "Bonjour {{student.firstName}},\n\nNous avons reçu {{payment.amount}} par {{payment.method}} (référence {{payment.reference}}) pour la candidature {{application.reference}} à {{institution.name}}.\n\nConservez cet e-mail comme reçu.",
  },
  "PAY-RECEIVED-SMS": {
    name: "SMS de paiement des frais",
    subject: "",
    body: "{{platform.name}} : {{payment.amount}} reçu, réf. {{payment.reference}}. Merci.",
  },
  "PAY-REJECTED-EMAIL": {
    name: "Paiement des frais non accepté",
    subject: "Nous n'avons pas pu accepter votre paiement pour {{institution.name}}",
    body: "Bonjour {{student.firstName}},\n\nVotre paiement de {{payment.amount}} (référence {{payment.reference}}) pour la candidature {{application.reference}} à {{institution.name}} n'a pas pu être accepté.\n\nMotif : {{reason}}\n\nVérifiez les informations et enregistrez à nouveau le paiement sur {{portal.url}}.",
  },
  "PAY-REJECTED-SMS": {
    name: "SMS de paiement non accepté",
    subject: "",
    body: "{{platform.name}} : votre paiement réf. {{payment.reference}} pour {{institution.name}} n'a pas été accepté. Voir {{portal.url}}",
  },
  "PAY-FAILED-SMS": {
    name: "SMS d'échec de paiement",
    subject: "",
    body: "{{platform.name}} : votre paiement {{payment.method}} de {{payment.amount}} n'a pas abouti. Aucun montant n'a été prélevé. Veuillez réessayer.",
  },
  "TUI-RECORDED-INAPP": {
    name: "Paiement de frais de scolarité enregistré",
    subject: "Paiement de frais de scolarité enregistré",
    body: "Nous avons enregistré votre paiement de {{payment.amount}} ({{payment.reference}}). {{institution.name}} le vérifiera avant qu'il ne compte dans vos frais de scolarité.",
  },
  "UPLOAD-RECEIVED-INAPP": {
    name: "Document reçu",
    subject: "{{document.name}} reçu",
    body: "Nous avons reçu votre {{document.name}} pour {{institution.name}}. L'établissement le vérifiera lors de l'examen de votre candidature.",
  },
  "VER-PAYMENT-EMAIL": {
    name: "Frais confirmés par l'établissement",
    subject: "{{institution.name}} a confirmé vos frais de candidature",
    body: "Bonjour {{student.firstName}},\n\n{{institution.name}} a confirmé avoir reçu vos frais de candidature pour la candidature {{application.reference}}.",
  },
  "VER-ACK-EMAIL": {
    name: "Candidature prise en compte",
    subject: "{{institution.name}} examine votre candidature",
    body: "Bonjour {{student.firstName}},\n\n{{institution.name}} a pris en compte la candidature {{application.reference}} et a commencé à l'examiner.",
  },
  "TUI-VERIFIED-SMS": {
    name: "SMS de frais de scolarité vérifiés",
    subject: "",
    body: "{{platform.name}} : {{institution.name}} a vérifié votre paiement de frais de scolarité de {{payment.amount}}. Reste à payer : {{tuition.outstanding}}.",
  },
  "TUI-VERIFIED-EMAIL": {
    name: "E-mail de frais de scolarité vérifiés",
    subject: "Paiement de frais de scolarité vérifié",
    body: "Bonjour {{student.firstName}},\n\n{{institution.name}} a vérifié votre paiement de frais de scolarité de {{payment.amount}} (référence {{payment.reference}}).\n\nFrais de scolarité pour {{academicYear}} : {{tuition.amount}}\nReste à payer : {{tuition.outstanding}}",
  },
  "VER-ACK-SMS": {
    name: "SMS de candidature prise en compte",
    subject: "",
    body: "{{platform.name}} : {{institution.name}} examine votre candidature {{application.reference}}.",
  },
  "APP-REJECTED-EMAIL": {
    name: "Candidature non retenue",
    subject: "Votre candidature à {{institution.name}}",
    body: "Bonjour {{student.firstName}},\n\nNous sommes désolés — {{institution.name}} ne peut pas vous proposer de place en {{application.program}}.\n\nMotif : {{reason}}\n\nCela n'affecte pas vos autres candidatures.",
  },
  "UPLOAD-REJECTED-EMAIL": {
    name: "Document rejeté",
    subject: "Action requise : {{document.name}}",
    body: "Bonjour {{student.firstName}},\n\n{{institution.name}} n'a pas pu accepter votre {{document.name}} : {{reason}}.\n\nTéléversez une nouvelle copie avant le {{deadline}} sur {{portal.url}}.",
  },
  "TUI-REJECTED-EMAIL": {
    name: "Paiement de frais de scolarité rejeté",
    subject: "Nous n'avons pas pu vérifier votre paiement de frais de scolarité",
    body: "Bonjour {{student.firstName}},\n\n{{institution.name}} n'a pas pu vérifier votre paiement de {{payment.amount}} (référence {{payment.reference}}).\n\nMotif : {{reason}}\n\nVérifiez les informations et enregistrez à nouveau le paiement, ou contactez l'économat de l'établissement.",
  },
  "RESUB-REQUEST-EMAIL": {
    name: "Nouvelle soumission demandée",
    subject: "Merci de soumettre à nouveau votre {{document.name}}",
    body: "Bonjour {{student.firstName}},\n\n{{institution.name}} vous demande de soumettre à nouveau votre {{document.name}} avant le {{deadline}}.\n\nMotif : {{reason}}",
  },
  "RESUB-RECEIVED-INAPP": {
    name: "Nouvelle soumission reçue",
    subject: "{{application.reference}} soumise à nouveau",
    body: "{{student.fullName}} a corrigé la candidature {{application.reference}} et l'a envoyée à nouveau.",
  },
  "RESUB-REQUEST-SMS": {
    name: "SMS de nouvelle soumission (ancien texte)",
    subject: "",
    body: "Cheeta : merci de soumettre à nouveau {{document.name}} avant le {{deadline}}.",
  },
  "ADM-OFFER-EMAIL": {
    name: "Offre d'admission",
    subject: "Offre d'admission : {{application.program}}",
    body: "Cher/Chère {{student.fullName}},\n\nFélicitations ! {{institution.name}} a le plaisir de vous proposer une place en {{application.program}}.\n\nVotre numéro d'admission est {{admission.number}}. Votre lettre d'admission est disponible sur {{letter.url}}\n\nConnectez-vous sur {{portal.url}} pour accepter l'offre, puis suivez les instructions de {{institution.name}} pour l'inscription.",
  },
  "ADM-OFFER-SMS": {
    name: "SMS d'offre d'admission",
    subject: "",
    body: "{{platform.name}} : félicitations {{student.firstName}} ! {{institution.name}} vous propose une place ({{admission.number}}). Détails sur {{portal.url}}",
  },
  "ADM-OFFER-INAPP": {
    name: "Offre d'admission (dans l'application)",
    subject: "Offre d'admission de {{institution.name}}",
    body: "{{institution.name}} vous propose une place en {{application.program}} ({{admission.number}}). Acceptez l'offre et téléchargez votre lettre d'admission depuis votre candidature.",
  },
  "ADM-PROV-EMAIL": {
    name: "Offre d'admission provisoire",
    subject: "Offre d'admission provisoire : {{application.program}}",
    body: "Cher/Chère {{student.fullName}},\n\n{{institution.name}} a le plaisir de vous proposer une place provisoire en {{application.program}} ({{admission.number}}).\n\nL'offre deviendra définitive une fois ces conditions remplies, avant le {{deadline}} :\n{{conditions}}\n\nVotre lettre d'admission provisoire est disponible sur {{letter.url}}. Vous pouvez accepter l'offre dès maintenant ; vous ne pourrez être immatriculé qu'après la confirmation par l'établissement que les conditions sont remplies.",
  },
  "ADM-PROV-SMS": {
    name: "SMS d'offre provisoire",
    subject: "",
    body: "{{platform.name}} : {{institution.name}} vous propose une place provisoire ({{admission.number}}), sous conditions à remplir avant le {{deadline}}. Détails sur {{portal.url}}",
  },
  "ADM-PROV-INAPP": {
    name: "Offre provisoire (dans l'application)",
    subject: "Offre provisoire de {{institution.name}}",
    body: "{{institution.name}} vous propose une place provisoire en {{application.program}} ({{admission.number}}). Conditions, avant le {{deadline}} : {{conditions}}",
  },
  "ADM-MET-EMAIL": {
    name: "Admission provisoire confirmée",
    subject: "Votre admission est confirmée : {{application.program}}",
    body: "Cher/Chère {{student.fullName}},\n\n{{institution.name}} a confirmé que les conditions de votre admission provisoire sont remplies. Votre admission en {{application.program}} ({{admission.number}}) est désormais définitive.\n\nVotre nouvelle lettre d'admission est disponible sur {{letter.url}}",
  },
  "ADM-MET-INAPP": {
    name: "Admission provisoire confirmée (dans l'application)",
    subject: "Admission confirmée par {{institution.name}}",
    body: "Les conditions de votre admission provisoire sont remplies : votre admission en {{application.program}} ({{admission.number}}) est désormais définitive. Téléchargez votre nouvelle lettre d'admission depuis votre candidature.",
  },
  "ADM-WITHDRAWN-EMAIL": {
    name: "Admission provisoire retirée",
    subject: "Votre admission provisoire à {{institution.name}}",
    body: "Cher/Chère {{student.fullName}},\n\nNous sommes désolés : les conditions de votre admission provisoire en {{application.program}} ({{admission.number}}) n'ont pas été remplies ; {{institution.name}} a donc retiré l'offre.\n\nConditions : {{conditions}}\n{{reason}}\n\nCela n'affecte pas vos autres candidatures.",
  },
  "ADM-WITHDRAWN-INAPP": {
    name: "Admission provisoire retirée (dans l'application)",
    subject: "Admission provisoire retirée",
    body: "{{institution.name}} a retiré votre admission provisoire en {{application.program}} ({{admission.number}}) : les conditions n'ont pas été remplies. {{reason}}",
  },
};
