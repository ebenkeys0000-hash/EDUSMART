export type EducationalLevelKey =
  | 'preschool'
  | 'primary'
  | 'junior_secondary'
  | 'senior_secondary'
  | 'technical_vocational';

export interface BilingualClassTemplate {
  order: number;
  levelKey: EducationalLevelKey;
  levelFr: string;
  levelEn: string;
  nameFr: string;
  nameEn: string;
  defaultSection: string;
  defaultCapacity: number;
}

export const EDUCATIONAL_LEVELS: {
  key: EducationalLevelKey;
  labelFr: string;
  labelEn: string;
  rangeFr: string;
  rangeEn: string;
}[] = [
  {
    key: 'preschool',
    labelFr: 'Maternelle',
    labelEn: 'Nursery & Preschool',
    rangeFr: 'Petite Section → Grande Section',
    rangeEn: 'Nursery 1 → Nursery 3',
  },
  {
    key: 'primary',
    labelFr: 'Primaire',
    labelEn: 'Primary Education',
    rangeFr: 'CI → CM2',
    rangeEn: 'Primary 1 → Primary 6',
  },
  {
    key: 'junior_secondary',
    labelFr: 'Collège (1er Cycle)',
    labelEn: 'Junior Secondary (JSS)',
    rangeFr: '6e → 3e',
    rangeEn: 'Grade 7 → Grade 10',
  },
  {
    key: 'senior_secondary',
    labelFr: 'Lycée (2nd Cycle)',
    labelEn: 'Senior Secondary (SSS)',
    rangeFr: 'Seconde → Terminale',
    rangeEn: 'Grade 11 → Grade 13',
  },
  {
    key: 'technical_vocational',
    labelFr: 'Enseignement Technique & Pro',
    labelEn: 'Technical & Vocational',
    rangeFr: 'Filières techniques & professionnelles',
    rangeEn: 'Technical & Vocational Tracks',
  },
];

export const STANDARD_BILINGUAL_CLASSES: BilingualClassTemplate[] = [
  { order: 1, levelKey: 'preschool', levelFr: 'Maternelle', levelEn: 'Nursery', nameFr: 'Petite Section', nameEn: 'Nursery 1', defaultSection: 'A', defaultCapacity: 25 },
  { order: 2, levelKey: 'preschool', levelFr: 'Maternelle', levelEn: 'Nursery', nameFr: 'Moyenne Section', nameEn: 'Nursery 2', defaultSection: 'A', defaultCapacity: 28 },
  { order: 3, levelKey: 'preschool', levelFr: 'Maternelle', levelEn: 'Nursery', nameFr: 'Grande Section', nameEn: 'Nursery 3', defaultSection: 'A', defaultCapacity: 30 },
  { order: 4, levelKey: 'primary', levelFr: 'Primaire', levelEn: 'Primary', nameFr: 'CI', nameEn: 'Primary 1', defaultSection: 'A', defaultCapacity: 35 },
  { order: 5, levelKey: 'primary', levelFr: 'Primaire', levelEn: 'Primary', nameFr: 'CP', nameEn: 'Primary 2', defaultSection: 'A', defaultCapacity: 35 },
  { order: 6, levelKey: 'primary', levelFr: 'Primaire', levelEn: 'Primary', nameFr: 'CE1', nameEn: 'Primary 3', defaultSection: 'A', defaultCapacity: 38 },
  { order: 7, levelKey: 'primary', levelFr: 'Primaire', levelEn: 'Primary', nameFr: 'CE2', nameEn: 'Primary 4', defaultSection: 'A', defaultCapacity: 38 },
  { order: 8, levelKey: 'primary', levelFr: 'Primaire', levelEn: 'Primary', nameFr: 'CM1', nameEn: 'Primary 5', defaultSection: 'A', defaultCapacity: 40 },
  { order: 9, levelKey: 'primary', levelFr: 'Primaire', levelEn: 'Primary', nameFr: 'CM2', nameEn: 'Primary 6', defaultSection: 'A', defaultCapacity: 40 },
  { order: 10, levelKey: 'junior_secondary', levelFr: 'Collège', levelEn: 'Junior Secondary', nameFr: '6e', nameEn: 'Grade 7', defaultSection: 'A', defaultCapacity: 42 },
  { order: 11, levelKey: 'junior_secondary', levelFr: 'Collège', levelEn: 'Junior Secondary', nameFr: '5e', nameEn: 'Grade 8', defaultSection: 'A', defaultCapacity: 42 },
  { order: 12, levelKey: 'junior_secondary', levelFr: 'Collège', levelEn: 'Junior Secondary', nameFr: '4e', nameEn: 'Grade 9', defaultSection: 'A', defaultCapacity: 40 },
  { order: 13, levelKey: 'junior_secondary', levelFr: 'Collège', levelEn: 'Junior Secondary', nameFr: '3e', nameEn: 'Grade 10', defaultSection: 'A', defaultCapacity: 40 },
  { order: 14, levelKey: 'senior_secondary', levelFr: 'Lycée', levelEn: 'Senior Secondary', nameFr: 'Seconde', nameEn: 'Grade 11', defaultSection: 'A', defaultCapacity: 40 },
  { order: 15, levelKey: 'senior_secondary', levelFr: 'Lycée', levelEn: 'Senior Secondary', nameFr: 'Première', nameEn: 'Grade 12', defaultSection: 'A', defaultCapacity: 38 },
  { order: 16, levelKey: 'senior_secondary', levelFr: 'Lycée', levelEn: 'Senior Secondary', nameFr: 'Terminale', nameEn: 'Grade 13', defaultSection: 'A', defaultCapacity: 38 },
];

export const AFRICAN_COUNTRIES: {
  code: string;
  nameFr: string;
  nameEn: string;
  defaultSystem: 'Francophone' | 'Anglophone' | 'Bilingual';
  defaultScale: number;
  defaultPassMark: number;
}[] = [
  { code: 'BJ', nameFr: 'Bénin', nameEn: 'Benin', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'TG', nameFr: 'Togo', nameEn: 'Togo', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'GH', nameFr: 'Ghana', nameEn: 'Ghana', defaultSystem: 'Anglophone', defaultScale: 100, defaultPassMark: 50 },
  { code: 'NG', nameFr: 'Nigeria', nameEn: 'Nigeria', defaultSystem: 'Anglophone', defaultScale: 100, defaultPassMark: 50 },
  { code: 'CI', nameFr: "Côte d'Ivoire", nameEn: 'Ivory Coast', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'SN', nameFr: 'Sénégal', nameEn: 'Senegal', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'BF', nameFr: 'Burkina Faso', nameEn: 'Burkina Faso', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'NE', nameFr: 'Niger', nameEn: 'Niger', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'ML', nameFr: 'Mali', nameEn: 'Mali', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'CM', nameFr: 'Cameroun', nameEn: 'Cameroon', defaultSystem: 'Bilingual', defaultScale: 20, defaultPassMark: 10 },
  { code: 'GA', nameFr: 'Gabon', nameEn: 'Gabon', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'CD', nameFr: 'RD Congo', nameEn: 'Democratic Republic of Congo', defaultSystem: 'Francophone', defaultScale: 20, defaultPassMark: 10 },
  { code: 'KE', nameFr: 'Kenya', nameEn: 'Kenya', defaultSystem: 'Anglophone', defaultScale: 100, defaultPassMark: 50 },
  { code: 'UG', nameFr: 'Ouganda', nameEn: 'Uganda', defaultSystem: 'Anglophone', defaultScale: 100, defaultPassMark: 50 },
  { code: 'TZ', nameFr: 'Tanzanie', nameEn: 'Tanzania', defaultSystem: 'Anglophone', defaultScale: 100, defaultPassMark: 50 },
  { code: 'RW', nameFr: 'Rwanda', nameEn: 'Rwanda', defaultSystem: 'Bilingual', defaultScale: 100, defaultPassMark: 50 },
  { code: 'ZA', nameFr: 'Afrique du Sud', nameEn: 'South Africa', defaultSystem: 'Anglophone', defaultScale: 100, defaultPassMark: 50 },
  { code: 'OTHER', nameFr: 'Autre pays africain / International', nameEn: 'Other African / International', defaultSystem: 'Bilingual', defaultScale: 20, defaultPassMark: 10 },
];

export const SUBJECT_CATEGORIES: {
  key: string;
  labelFr: string;
  labelEn: string;
}[] = [
  { key: 'Languages and Literature', labelFr: 'Langues et Littérature', labelEn: 'Languages and Literature' },
  { key: 'Mathematics', labelFr: 'Mathématiques', labelEn: 'Mathematics' },
  { key: 'Natural Sciences', labelFr: 'Sciences Naturelles', labelEn: 'Natural Sciences' },
  { key: 'Social Sciences', labelFr: 'Sciences Sociales', labelEn: 'Social Sciences' },
  { key: 'Humanities', labelFr: 'Humanités & Philosophie', labelEn: 'Humanities' },
  { key: 'Technology and Computing', labelFr: 'Technologie et Informatique', labelEn: 'Technology and Computing' },
  { key: 'Arts and Music', labelFr: 'Arts et Musique', labelEn: 'Arts and Music' },
  { key: 'Physical Education', labelFr: 'Éducation Physique & Sportive', labelEn: 'Physical Education' },
  { key: 'Religious and Moral Education', labelFr: 'Éducation Religieuse et Morale', labelEn: 'Religious and Moral Education' },
  { key: 'Economics and Business', labelFr: 'Économie et Gestion', labelEn: 'Economics and Business' },
  { key: 'Agriculture', labelFr: 'Agriculture & Agronomie', labelEn: 'Agriculture' },
  { key: 'Technical and Vocational Studies', labelFr: 'Études Techniques et Professionnelles', labelEn: 'Technical and Vocational Studies' },
];

export interface LibrarySubjectItem {
  code: string;
  nameFr: string;
  nameEn: string;
  category: string;
  levelScope:
    | 'preschool'
    | 'primary'
    | 'junior_secondary'
    | 'senior_secondary'
    | 'general'
    | 'scientific'
    | 'literary'
    | 'technical'
    | 'vocational';
  suggestedCoeff: number;
  descriptionFr: string;
  descriptionEn: string;
}

export const AFRICAN_SUBJECT_LIBRARY: LibrarySubjectItem[] = [
  // Preschool & Primary
  { code: 'EVL', nameFr: 'Éveil & Langage', nameEn: 'Early Literacy & Phonics', category: 'Languages and Literature', levelScope: 'preschool', suggestedCoeff: 2, descriptionFr: 'Expression orale, comptines et éveil graphique', descriptionEn: 'Phonics, storytelling, and early speech readiness' },
  { code: 'NUM', nameFr: 'Calcul & Éveil Logique', nameEn: 'Early Numeracy', category: 'Mathematics', levelScope: 'preschool', suggestedCoeff: 2, descriptionFr: 'Nombres, formes et repérage spatial', descriptionEn: 'Counting, shapes, and basic logical sorting' },
  { code: 'MOT', nameFr: 'Psychomotricité & Jeux', nameEn: 'Motor Skills & Play', category: 'Physical Education', levelScope: 'preschool', suggestedCoeff: 1, descriptionFr: 'Coordination motrice et jeux éducatifs', descriptionEn: 'Motor coordination and guided play' },
  { code: 'LECT', nameFr: 'Lecture & Écriture', nameEn: 'Reading & Writing', category: 'Languages and Literature', levelScope: 'primary', suggestedCoeff: 3, descriptionFr: 'Compréhension de texte, dictée et rédaction', descriptionEn: 'Reading comprehension, spelling, and composition' },
  { code: 'EST', nameFr: 'Éducation Scientifique & Technologique', nameEn: 'Primary Science & Discovery', category: 'Natural Sciences', levelScope: 'primary', suggestedCoeff: 2, descriptionFr: 'Découverte du milieu, corps humain et hygiène', descriptionEn: 'Nature study, human health, and basic environment' },
  { code: 'ECM', nameFr: 'Éducation Civique & Morale', nameEn: 'Civic & Moral Education', category: 'Religious and Moral Education', levelScope: 'primary', suggestedCoeff: 1, descriptionFr: 'Citoyenneté, valeurs civiques et vivre-ensemble', descriptionEn: 'Citizenship, ethics, and community responsibility' },

  // Languages & Literature
  { code: 'FR', nameFr: 'Français', nameEn: 'French Language & Literature', category: 'Languages and Literature', levelScope: 'general', suggestedCoeff: 3, descriptionFr: 'Grammaire, dissertation, commentaire de texte', descriptionEn: 'French grammar, essay writing, and literary analysis' },
  { code: 'ENG', nameFr: 'Anglais', nameEn: 'English Language', category: 'Languages and Literature', levelScope: 'general', suggestedCoeff: 2, descriptionFr: 'Compréhension, expression écrite et orale en anglais', descriptionEn: 'English comprehension, grammar, and literature' },
  { code: 'LIT', nameFr: 'Littérature Africaine & Comparée', nameEn: 'Literature in English / African Literature', category: 'Languages and Literature', levelScope: 'literary', suggestedCoeff: 3, descriptionFr: 'Œuvres africaines francophones et anglophones', descriptionEn: 'African poetry, drama, and prose traditions' },
  { code: 'ESP', nameFr: 'Espagnol (LV2)', nameEn: 'Spanish', category: 'Languages and Literature', levelScope: 'literary', suggestedCoeff: 2, descriptionFr: 'Langue vivante seconde : espagnol', descriptionEn: 'Second foreign language: Spanish' },
  { code: 'ALL', nameFr: 'Allemand (LV2)', nameEn: 'German', category: 'Languages and Literature', levelScope: 'literary', suggestedCoeff: 2, descriptionFr: 'Langue vivante seconde : allemand', descriptionEn: 'Second foreign language: German' },
  { code: 'ARAB', nameFr: 'Arabe', nameEn: 'Arabic', category: 'Languages and Literature', levelScope: 'general', suggestedCoeff: 2, descriptionFr: 'Langue arabe et civilisation', descriptionEn: 'Arabic language and reading comprehension' },

  // Mathematics & Natural Sciences
  { code: 'MATH', nameFr: 'Mathématiques', nameEn: 'Mathematics', category: 'Mathematics', levelScope: 'general', suggestedCoeff: 4, descriptionFr: 'Algèbre, géométrie, analyse et probabilités', descriptionEn: 'Algebra, geometry, calculus, and statistics' },
  { code: 'MATH-ADD', nameFr: 'Mathématiques Approfondies', nameEn: 'Further Mathematics', category: 'Mathematics', levelScope: 'scientific', suggestedCoeff: 5, descriptionFr: 'Analyse avancée, arithmétique et algèbre linéaire', descriptionEn: 'Advanced calculus, mechanics, and linear algebra' },
  { code: 'PC', nameFr: 'Physique-Chimie', nameEn: 'Physics & Chemistry', category: 'Natural Sciences', levelScope: 'scientific', suggestedCoeff: 4, descriptionFr: 'Mécanique, électricité, chimie organique et minérale', descriptionEn: 'Mechanics, electricity, and chemical reactions' },
  { code: 'PHY', nameFr: 'Physique', nameEn: 'Physics', category: 'Natural Sciences', levelScope: 'scientific', suggestedCoeff: 4, descriptionFr: 'Lois physiques, optique et thermodynamique', descriptionEn: 'Classical physics, waves, and electromagnetism' },
  { code: 'CHM', nameFr: 'Chimie', nameEn: 'Chemistry', category: 'Natural Sciences', levelScope: 'scientific', suggestedCoeff: 3, descriptionFr: 'Chimie analytique, solutions et réactions', descriptionEn: 'Organic, inorganic, and analytical chemistry' },
  { code: 'SVT', nameFr: 'Sciences de la Vie et de la Terre (SVT)', nameEn: 'Biology & Earth Sciences', category: 'Natural Sciences', levelScope: 'scientific', suggestedCoeff: 3, descriptionFr: 'Biologie cellulaire, génétique, écologie et géologie', descriptionEn: 'Cell biology, genetics, ecology, and geology' },

  // Social Sciences & Humanities
  { code: 'HG', nameFr: 'Histoire-Géographie', nameEn: 'History & Geography', category: 'Social Sciences', levelScope: 'general', suggestedCoeff: 2, descriptionFr: 'Histoire de l’Afrique et du monde, géographie humaine', descriptionEn: 'African & world history and physical/human geography' },
  { code: 'PHILO', nameFr: 'Philosophie', nameEn: 'Philosophy', category: 'Humanities', levelScope: 'literary', suggestedCoeff: 3, descriptionFr: 'Logique, épistémologie, éthique et dissertation', descriptionEn: 'Critical thinking, ethics, and philosophical essays' },
  { code: 'SOC', nameFr: 'Sociologie & Éducation Civique', nameEn: 'Social Studies & Civics', category: 'Social Sciences', levelScope: 'junior_secondary', suggestedCoeff: 2, descriptionFr: 'Institutions républicaines, droits humains et société', descriptionEn: 'Governance, social institutions, and civic duties' },

  // Technology, Computing, Arts, PE, Religion
  { code: 'INFO', nameFr: 'Informatique & Algorithmique', nameEn: 'Computer Science & ICT', category: 'Technology and Computing', levelScope: 'general', suggestedCoeff: 2, descriptionFr: 'Bureautique, programmation, réseaux et bases de données', descriptionEn: 'Digital literacy, coding, algorithms, and systems' },
  { code: 'TECH', nameFr: 'Technologie & Dessin Technique', nameEn: 'Design & Technology', category: 'Technology and Computing', levelScope: 'junior_secondary', suggestedCoeff: 2, descriptionFr: 'Initiation technologique et lecture de plans', descriptionEn: 'Engineering design basics and technical sketching' },
  { code: 'ART', nameFr: 'Arts Plastiques & Musique', nameEn: 'Creative Arts & Music', category: 'Arts and Music', levelScope: 'general', suggestedCoeff: 1, descriptionFr: 'Dessin, patrimoine artistique africain et chant choral', descriptionEn: 'Visual arts, African cultural crafts, and music' },
  { code: 'EPS', nameFr: 'Éducation Physique et Sportive (EPS)', nameEn: 'Physical Education (PE)', category: 'Physical Education', levelScope: 'general', suggestedCoeff: 1, descriptionFr: 'Athlétisme, sports collectifs et condition physique', descriptionEn: 'Athletics, team sports, and physical fitness' },
  { code: 'REL', nameFr: 'Éducation Religieuse & Éthique', nameEn: 'Religious & Moral Education', category: 'Religious and Moral Education', levelScope: 'general', suggestedCoeff: 1, descriptionFr: 'Dialogue interreligieux, morale et valeurs humaines', descriptionEn: 'Comparative ethics, faith studies, and moral reasoning' },

  // Economics, Business & Agriculture
  { code: 'ECO', nameFr: 'Sciences Économiques et Sociales (SES)', nameEn: 'Economics', category: 'Economics and Business', levelScope: 'senior_secondary', suggestedCoeff: 4, descriptionFr: 'Microéconomie, macroéconomie et développement', descriptionEn: 'Microeconomics, macroeconomics, and trade' },
  { code: 'COMPT', nameFr: 'Comptabilité & Gestion Financière', nameEn: 'Financial Accounting', category: 'Economics and Business', levelScope: 'technical', suggestedCoeff: 4, descriptionFr: 'Comptabilité SYSCOHADA / IFRS, bilan et trésorerie', descriptionEn: 'Bookkeeping, ledgers, and financial statements' },
  { code: 'MGMT', nameFr: 'Gestion des Entreprises & Commerce', nameEn: 'Business Studies & Commerce', category: 'Economics and Business', levelScope: 'vocational', suggestedCoeff: 3, descriptionFr: 'Entrepreneuriat, marketing et droit des affaires', descriptionEn: 'Entrepreneurship, marketing, and business operations' },
  { code: 'AGRO', nameFr: 'Agronomie & Production Végétale', nameEn: 'Agricultural Science', category: 'Agriculture', levelScope: 'vocational', suggestedCoeff: 3, descriptionFr: 'Pédologie, cultures vivrières et agroécologie', descriptionEn: 'Crop production, soil science, and agribusiness' },
  { code: 'ZOOT', nameFr: 'Élevage & Production Animale', nameEn: 'Animal Husbandry', category: 'Agriculture', levelScope: 'vocational', suggestedCoeff: 3, descriptionFr: 'Zootechnie, santé animale et gestion de ferme', descriptionEn: 'Livestock care, nutrition, and farm management' },

  // Technical & Vocational
  { code: 'ELEC', nameFr: 'Électrotechnique & Installations', nameEn: 'Electrical Engineering', category: 'Technical and Vocational Studies', levelScope: 'technical', suggestedCoeff: 4, descriptionFr: 'Circuits électriques, schémas et installations industrielles', descriptionEn: 'Power circuits, wiring systems, and electrical machines' },
  { code: 'ELN', nameFr: 'Électronique & Systèmes Embarqués', nameEn: 'Electronics', category: 'Technical and Vocational Studies', levelScope: 'technical', suggestedCoeff: 4, descriptionFr: 'Composants analogiques, logique numérique et capteurs', descriptionEn: 'Analog/digital electronics and circuit diagnostics' },
  { code: 'MECA', nameFr: 'Génie Mécanique & Construction', nameEn: 'Mechanical Engineering', category: 'Technical and Vocational Studies', levelScope: 'technical', suggestedCoeff: 4, descriptionFr: 'Résistance des matériaux, fabrication et CAO', descriptionEn: 'Mechanics, fabrication, and CAD engineering' },
  { code: 'GCIV', nameFr: 'Génie Civil & Bâtiment', nameEn: 'Civil Engineering & Building', category: 'Technical and Vocational Studies', levelScope: 'technical', suggestedCoeff: 4, descriptionFr: 'Topographie, béton armé et métré de chantier', descriptionEn: 'Structural design, surveying, and construction' },
  { code: 'AUTO', nameFr: 'Mécanique Automobile', nameEn: 'Automotive Mechanics', category: 'Technical and Vocational Studies', levelScope: 'vocational', suggestedCoeff: 4, descriptionFr: 'Moteurs thermiques, diagnostic et maintenance auto', descriptionEn: 'Engine systems, diagnostics, and vehicle repair' },
  { code: 'ENER', nameFr: 'Énergies Renouvelables & Solaire', nameEn: 'Renewable & Solar Energy', category: 'Technical and Vocational Studies', levelScope: 'vocational', suggestedCoeff: 4, descriptionFr: 'Systèmes photovoltaïques, dimensionnement et maintenance', descriptionEn: 'Solar PV design, battery storage, and clean energy' },
  { code: 'HOT', nameFr: 'Hôtellerie & Restauration', nameEn: 'Hospitality & Culinary Arts', category: 'Technical and Vocational Studies', levelScope: 'vocational', suggestedCoeff: 3, descriptionFr: 'Arts culinaires, accueil et gestion hôtelière', descriptionEn: 'Culinary operations, front office, and food service' },
  { code: 'MODE', nameFr: 'Coupe, Couture & Stylisme', nameEn: 'Fashion & Clothing Design', category: 'Technical and Vocational Studies', levelScope: 'vocational', suggestedCoeff: 3, descriptionFr: 'Patronage, confection textile et design de mode', descriptionEn: 'Pattern making, tailoring, and garment production' },
];

export interface StarterSeriesTemplate {
  code: string;
  nameFr: string;
  nameEn: string;
  category: 'general' | 'scientific' | 'literary' | 'economic' | 'technical' | 'vocational';
  levelScope: string;
  descriptionFr: string;
  descriptionEn: string;
  subjectCodes: string[];
}

export const STANDARD_ACADEMIC_SERIES: StarterSeriesTemplate[] = [
  {
    code: 'SER-A',
    nameFr: 'Série A — Lettres & Philosophie',
    nameEn: 'Series A — Literary Studies',
    category: 'literary',
    levelScope: 'senior_secondary',
    descriptionFr: 'Dominante lettres, langues vivantes, philosophie et histoire-géographie',
    descriptionEn: 'Focus on literature, modern languages, philosophy, and history',
    subjectCodes: ['FR', 'PHILO', 'ENG', 'HG', 'LIT', 'ESP', 'MATH', 'EPS'],
  },
  {
    code: 'SER-C',
    nameFr: 'Série C — Mathématiques & Sciences Physiques',
    nameEn: 'Series C — Mathematics & Physical Sciences',
    category: 'scientific',
    levelScope: 'senior_secondary',
    descriptionFr: 'Dominante mathématiques approfondies, physique et chimie',
    descriptionEn: 'Focus on advanced mathematics, physics, and chemistry',
    subjectCodes: ['MATH', 'MATH-ADD', 'PC', 'PHY', 'CHM', 'FR', 'ENG', 'SVT', 'INFO'],
  },
  {
    code: 'SER-D',
    nameFr: 'Série D — Mathématiques & Sciences de la Vie',
    nameEn: 'Series D — Mathematics & Life Sciences',
    category: 'scientific',
    levelScope: 'senior_secondary',
    descriptionFr: 'Équilibre entre mathématiques, physique-chimie et SVT',
    descriptionEn: 'Balanced track in mathematics, biology, physics, and chemistry',
    subjectCodes: ['SVT', 'PC', 'MATH', 'FR', 'ENG', 'HG', 'PHILO', 'INFO'],
  },
  {
    code: 'SER-SCI',
    nameFr: 'Série Scientifique (Sciences)',
    nameEn: 'Scientific Series',
    category: 'scientific',
    levelScope: 'senior_secondary',
    descriptionFr: 'Parcours STEM anglophone / bilingue (Maths, Physics, Chemistry, Biology)',
    descriptionEn: 'STEM pathway covering Mathematics, Physics, Chemistry, Biology & ICT',
    subjectCodes: ['MATH', 'PHY', 'CHM', 'SVT', 'ENG', 'INFO'],
  },
  {
    code: 'SER-LIT',
    nameFr: 'Série Littéraire (Arts & Humanities)',
    nameEn: 'Literary Series',
    category: 'literary',
    levelScope: 'senior_secondary',
    descriptionFr: 'Parcours humanités, langues, littérature et sciences humaines',
    descriptionEn: 'Humanities track covering Literature, Languages, History & Government',
    subjectCodes: ['LIT', 'ENG', 'FR', 'HG', 'PHILO', 'REL'],
  },
  {
    code: 'SER-ES',
    nameFr: 'Série Économique et Sociale (B / G)',
    nameEn: 'Economic and Social Studies Series',
    category: 'economic',
    levelScope: 'senior_secondary',
    descriptionFr: 'Économie, comptabilité, mathématiques appliquées et gestion',
    descriptionEn: 'Economics, accounting, commerce, and applied mathematics',
    subjectCodes: ['ECO', 'COMPT', 'MGMT', 'MATH', 'FR', 'ENG', 'HG'],
  },
  {
    code: 'SER-TECH',
    nameFr: 'Série Technique (F / STI / Commerciale)',
    nameEn: 'Technical Series',
    category: 'technical',
    levelScope: 'technical_vocational',
    descriptionFr: 'Sciences de l’ingénieur, génie électrique, civil, mécanique et gestion',
    descriptionEn: 'Engineering sciences, computing, civil/electrical/mechanical tracks',
    subjectCodes: ['MATH', 'PC', 'INFO', 'ELEC', 'GCIV', 'MECA', 'COMPT', 'FR', 'ENG'],
  },
  {
    code: 'SER-VOC',
    nameFr: 'Série Professionnelle (CAP / BT / TVET)',
    nameEn: 'Vocational Series',
    category: 'vocational',
    levelScope: 'technical_vocational',
    descriptionFr: 'Métiers pratiques, agriculture, hôtellerie, couture, mécanique et solaire',
    descriptionEn: 'Hands-on vocational trades, agribusiness, hospitality, and clean energy',
    subjectCodes: ['MGMT', 'INFO', 'AGRO', 'HOT', 'MODE', 'AUTO', 'ENER', 'FR', 'ENG'],
  },
];

export interface VocationalTrackTemplate {
  code: string;
  nameFr: string;
  nameEn: string;
  sector: string;
  descriptionFr: string;
  descriptionEn: string;
  subjectCodes: string[];
}

export const TECHNICAL_VOCATIONAL_TRACKS: VocationalTrackTemplate[] = [
  { code: 'TRK-ELEC', nameFr: 'Génie Électrique / Électrotechnique', nameEn: 'Electrical Engineering', sector: 'engineering', descriptionFr: 'Installations électriques, automatismes et distribution d’énergie', descriptionEn: 'Electrical installations, power distribution, and industrial systems', subjectCodes: ['ELEC', 'MATH', 'PC', 'INFO', 'FR', 'ENG'] },
  { code: 'TRK-ELN', nameFr: 'Électronique & Maintenance', nameEn: 'Electronics', sector: 'engineering', descriptionFr: 'Circuits électroniques, systèmes numériques et télécoms', descriptionEn: 'Electronic circuits, digital systems, and diagnostics', subjectCodes: ['ELN', 'MATH', 'PC', 'INFO', 'ENG'] },
  { code: 'TRK-MECA', nameFr: 'Génie Mécanique', nameEn: 'Mechanical Engineering', sector: 'engineering', descriptionFr: 'Fabrication mécanique, usinage et maintenance industrielle', descriptionEn: 'Mechanical design, machining, and industrial maintenance', subjectCodes: ['MECA', 'MATH', 'PC', 'TECH', 'FR'] },
  { code: 'TRK-GCIV', nameFr: 'Génie Civil', nameEn: 'Civil Engineering', sector: 'construction', descriptionFr: 'Structures, ouvrages d’art, topographie et études de plans', descriptionEn: 'Structural works, surveying, and civil infrastructure', subjectCodes: ['GCIV', 'MATH', 'PC', 'TECH', 'FR'] },
  { code: 'TRK-INFO', nameFr: 'Informatique & Systèmes Numériques', nameEn: 'Computer Science', sector: 'computing', descriptionFr: 'Développement logiciel, réseaux, maintenance et bases de données', descriptionEn: 'Software development, networking, and IT systems', subjectCodes: ['INFO', 'MATH', 'ENG', 'FR', 'MGMT'] },
  { code: 'TRK-COMP', nameFr: 'Comptabilité et Gestion', nameEn: 'Accounting and Management', sector: 'business', descriptionFr: 'Comptabilité générale, fiscalité, audit et gestion financière', descriptionEn: 'Financial accounting, taxation, and organizational management', subjectCodes: ['COMPT', 'ECO', 'MGMT', 'MATH', 'INFO', 'FR'] },
  { code: 'TRK-BUS', nameFr: 'Administration des Affaires', nameEn: 'Business Administration', sector: 'business', descriptionFr: 'Commerce, marketing, secrétariat de direction et entrepreneuriat', descriptionEn: 'Business operations, commerce, marketing, and leadership', subjectCodes: ['MGMT', 'ECO', 'COMPT', 'INFO', 'ENG', 'FR'] },
  { code: 'TRK-AGRO', nameFr: 'Agriculture & Agronomie', nameEn: 'Agriculture', sector: 'agriculture', descriptionFr: 'Cultures durables, irrigation et gestion d’exploitation agricole', descriptionEn: 'Sustainable crop farming, soil management, and agribusiness', subjectCodes: ['AGRO', 'SVT', 'MGMT', 'MATH', 'FR'] },
  { code: 'TRK-ANIM', nameFr: 'Production Animale & Élevage', nameEn: 'Animal Production', sector: 'agriculture', descriptionFr: 'Élevage moderne, nutrition animale et filières laitières/avicoles', descriptionEn: 'Modern livestock production, veterinary hygiene, and farm ops', subjectCodes: ['ZOOT', 'SVT', 'AGRO', 'MGMT', 'FR'] },
  { code: 'TRK-HOT', nameFr: 'Hôtellerie et Restauration', nameEn: 'Hotel and Restaurant Management', sector: 'hospitality', descriptionFr: 'Arts culinaires, service en salle, hébergement et tourisme', descriptionEn: 'Culinary arts, restaurant service, and hospitality operations', subjectCodes: ['HOT', 'MGMT', 'ENG', 'FR', 'COMPT'] },
  { code: 'TRK-MODE', nameFr: 'Stylisme, Coupe & Couture', nameEn: 'Fashion and Clothing Design', sector: 'creative', descriptionFr: 'Création textile, modélisme et confection professionnelle', descriptionEn: 'Apparel design, pattern drafting, and garment manufacturing', subjectCodes: ['MODE', 'ART', 'MGMT', 'FR'] },
  { code: 'TRK-BTP', nameFr: 'Bâtiment & Construction', nameEn: 'Construction', sector: 'construction', descriptionFr: 'Maçonnerie, coffrage, lecture de plans et conduite de travaux', descriptionEn: 'Masonry, building construction, and site supervision', subjectCodes: ['GCIV', 'TECH', 'MATH', 'FR'] },
  { code: 'TRK-AUTO', nameFr: 'Mécanique Automobile', nameEn: 'Automotive Mechanics', sector: 'engineering', descriptionFr: 'Entretien moteur, électricité auto et diagnostic électronique', descriptionEn: 'Vehicle diagnostics, engine repair, and auto electrics', subjectCodes: ['AUTO', 'MECA', 'PC', 'INFO', 'FR'] },
  { code: 'TRK-SOL', nameFr: 'Énergies Renouvelables', nameEn: 'Renewable Energy', sector: 'energy', descriptionFr: 'Solaire photovoltaïque, micro-réseaux et efficacité énergétique', descriptionEn: 'Solar PV engineering, clean power, and energy efficiency', subjectCodes: ['ENER', 'ELEC', 'MATH', 'PC', 'INFO'] },
];

export function localizeName(
  lang: 'fr' | 'en',
  frValue?: string | null,
  enValue?: string | null,
  fallback = ''
): string {
  if (lang === 'en') {
    return (enValue && enValue.trim()) || (frValue && frValue.trim()) || fallback;
  }
  return (frValue && frValue.trim()) || (enValue && enValue.trim()) || fallback;
}
