import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import {
  Baby,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  Cigarette,
  Flag,
  GraduationCap,
  Heart,
  Languages,
  MapPin,
  MoonStar,
  Palette,
  Plane,
  Ruler,
  ShieldCheck,
  Sparkles,
  Users,
  Wine,
} from "lucide-react-native";

import { AppBackTitleBar } from "@/components/app/AppBackTitleBar";
import { EditProfileMediaEditor } from "@/components/profile/EditProfileMediaEditor";
import { GradientButton } from "@/components/ui/GradientButton";
import { MultiSelectOption, MultiSelectSheet } from "@/components/ui/MultiSelectSheet";
import { SelectOption, SingleSelectSheet } from "@/components/ui/SingleSelectSheet";
import { Text } from "@/components/ui/Text";
import { COUNTRY_OPTIONS, LANGUAGE_OPTIONS, NATIONALITY_OPTIONS } from "@/constants/profileOptions";
import { Typography } from "@/constants/typography";
import { useEmailVerificationGuard } from "@/hooks/useEmailVerificationGuard";
import { useLanguage } from "@/hooks/useLanguage";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { type GalleryItem, type GalleryPrivacy } from "@/lib/galleryService";
import { PROFILE_PLACEHOLDER_IMAGE } from "@/lib/profileAssets";
import { formatProfileOptionLabel } from "@/lib/profileOptionLabels";
import {
  apiMessage,
  calculateAge,
  cleanProfileMultilineText,
  cleanProfileText,
  displayText,
  profileImage,
  selectLabel,
  t as translateText,
  translateCountry,
} from "@/lib/profileDisplay";
import { profileService } from "@/lib/profileService";
import {
  BIO_MAX,
  cleanHeadlineTextForSave,
  cleanProfileTextForSave,
  COMPANY_MAX,
  countNonSpace,
  formatAmount,
  HEADLINE_MAX,
  isAllowedProfileText,
  MAX_INCOME,
  parseAmount,
} from "@/lib/profileValidation";
import { useAuthStore } from "@/store/authStore";

type PlaceDetails = {
  place_id?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
};

type CompletionState = {
  percent: number;
  completed: number;
  total: number;
  missingKeys: string[];
};

type FieldRow = {
  id: string;
  label: string;
  value: string;
  completionKey?: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const NOT_SET = "Not set";
const PRIMARY = "#F34B6F";

const themeColors = (isDark: boolean) => ({
  background: isDark ? "#020617" : "#F8FAFC",
  surface: isDark ? "#0F172A" : "#FFFFFF",
  card: isDark ? "#111827" : "#F8FAFC",
  border: isDark ? "#334155" : "#E2E8F0",
  text: isDark ? "#F8FAFC" : "#17211D",
  muted: isDark ? "#94A3B8" : "#64748B",
  primary: PRIMARY,
});

const completionFields = (gender?: string | null) => {
  const base = [
    "profileName",
    "gender",
    "dob",
    "nationality",
    "grew_up_in",
    "mother_tongue",
    "languages_spoken",
    "born_muslim",
    "height",
    "complexion",
    "ethnic_group",
    "marital_status",
    "have_children",
    "wants_children",
    "marriage_plan",
    "relocation_plans",
    "education",
    "occupation",
    "annual_income",
    "company",
    "current_location",
    "sect",
    "maslak",
    "is_practising",
    "prayers",
    "smoking",
    "alcohol",
    "avatar",
    "gallery",
    "bio",
    "profile_headline",
    "profile_manager",
    "hobbies",
  ];

  if (String(gender || "").toLowerCase() === "female") {
    base.splice(8, 0, "i_usually_dress");
  }

  return base;
};

const hasValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return Boolean(value);

  const objectValue = value as Record<string, unknown>;
  return Boolean(
    objectValue.value_id ||
      objectValue.id ||
      objectValue.uuid ||
      objectValue.label ||
      objectValue.name ||
      objectValue.en ||
      objectValue.city ||
      objectValue.country ||
      objectValue.place_id,
  );
};

const localCompletion = (profile: any, gallery: GalleryItem[]): CompletionState => {
  const gender = profile?.gender;
  const keys = completionFields(gender);
  const checks: Record<string, boolean> = {
    profileName: hasValue(profile?.profileName || profile?.profile_name),
    gender: hasValue(profile?.gender),
    dob: hasValue(profile?.dob),
    nationality: hasValue(profile?.nationality),
    grew_up_in: hasValue(profile?.grew_up_in),
    mother_tongue: hasValue(profile?.mother_tongue),
    languages_spoken: hasValue(profile?.languages_spoken),
    born_muslim: hasValue(profile?.born_muslim),
    i_usually_dress: hasValue(profile?.i_usually_dress),
    height: hasValue(profile?.height),
    complexion: hasValue(profile?.complexion),
    ethnic_group: hasValue(profile?.ethnic_group),
    marital_status: hasValue(profile?.marital_status),
    have_children: hasValue(profile?.have_children),
    wants_children: hasValue(profile?.wants_children),
    marriage_plan: hasValue(profile?.marriage_plan),
    relocation_plans: hasValue(profile?.relocation_plans),
    education: hasValue(profile?.education),
    occupation: hasValue(profile?.occupation),
    annual_income: Boolean(profile?.annual_income?.amount && profile?.annual_income?.currency),
    company: hasValue(profile?.company),
    current_location: hasValue(profile?.current_location),
    sect: hasValue(profile?.sect),
    maslak: hasValue(profile?.maslak),
    is_practising: hasValue(profile?.is_practising),
    prayers: hasValue(profile?.prayers),
    smoking: hasValue(profile?.smoking),
    alcohol: hasValue(profile?.alcohol),
    avatar: hasValue(profile?.avatar) || gallery.some((item) => item.isPrimary),
    gallery: gallery.length > 0,
    bio: hasValue(profile?.bio),
    profile_headline: hasValue(profile?.profile_headline),
    profile_manager: hasValue(profile?.profile_manager),
    hobbies: hasValue(profile?.hobbies),
  };

  const completed = keys.filter((key) => checks[key]).length;
  const total = keys.length;
  return {
    percent: total ? Math.round((completed / total) * 100) : 0,
    completed,
    total,
    missingKeys: keys.filter((key) => !checks[key]),
  };
};

const formatList = (value: unknown, fallback: string) => {
  if (!Array.isArray(value)) return fallback;
  const labels = value
    .map((item) => selectLabel(item) || (typeof item === "string" ? displayText(item) : ""))
    .filter(Boolean);
  return labels.length ? labels.join(", ") : fallback;
};

const formatSelect = (value: unknown, fallback: string) =>
  selectLabel(value) || (typeof value === "string" ? displayText(value) : "") || fallback;

const formatLocation = (location: any, locale: string, fallback: string) => {
  if (!location) return fallback;
  const country = translateCountry(String(location.country || "")) || location.country;
  const parts = [location.city, location.state].filter(Boolean);
  if (country) parts.push(country);
  return parts.length ? parts.join(", ") : fallback;
};

const formatIncome = (income: any, fallback: string) => {
  if (!income?.amount) return fallback;
  const currency = income.currency ? `${income.currency} ` : "";
  return `${currency}${Number(income.amount).toLocaleString()}`;
};

const gainFor = (completion: CompletionState, key?: string) => {
  if (!key || !completion.total || !completion.missingKeys.includes(key)) return null;
  return Math.max(1, Math.round(100 / completion.total));
};

const MASTER_FIELDS = new Set([
  "height",
  "complexion",
  "ethnic_group",
  "education",
  "occupation",
  "designation",
  "sect",
  "maslak",
  "following",
]);

const MASTER_TYPES = [
  "height",
  "complexion",
  "ethnic_group",
  "education",
  "occupation",
  "designation",
  "sect",
  "maslak",
  "following",
] as const;

const SECT_FILTERS: Record<string, { maslak: string[]; following: string[] }> = {
  sunni: {
    maslak: ["hanafi", "shafi", "maliki", "hanbali", "not_applicable"],
    following: [
      "ahle_hadith",
      "ahle_sunnat",
      "deobandi",
      "barelvi",
      "sufi",
      "tabligi",
      "salafi",
      "just_muslim",
      "other_sunni",
    ],
  },
  shia: {
    maslak: ["jafari", "zaydi", "ismaili", "other"],
    following: ["ithna_ashari", "bohra", "ismaili", "zaidi", "just_shia", "other_shia"],
  },
  ibadi: {
    maslak: ["not_applicable", "other"],
    following: ["ahle_hadith", "ahle_sunnat", "salafi", "just_muslim", "other_sunni"],
  },
};

const PROFILE_MANAGER_OPTIONS = ["self", "father", "mother", "brother", "sister", "relative", "friend"] as const;

const normalizeMasterKey = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase();

const fieldValueId = (value: any) =>
  String(value?.value_id || value?._id || value?.id || value?.uuid || (typeof value === "string" ? value : "")).trim();

const fieldValueIds = (value: any) => (Array.isArray(value) ? value.map(fieldValueId).filter(Boolean) : []);

const normalizeLanguage = (language: string) => language.split("-")[0]?.trim() || "en";

const hasResolvedLocation = (details: PlaceDetails | undefined) => {
  if (!details) return false;
  const lat = Number(details.lat);
  const lng = Number(details.lng);

  return Boolean(
    details.place_id &&
      details.city?.trim() &&
      details.countryCode?.trim().match(/^[A-Z]{2}$/i) &&
      Number.isFinite(lat) &&
      Number.isFinite(lng),
  );
};

async function withLocationTimeout<T>(promise: Promise<T>, timeoutMs = 12000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("location_timeout")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export default function EditProfileScreen() {
  const { isDark } = useTheme();
  const { currentLanguage, isRTL } = useLanguage();
  const { scale } = useResponsive();
  const colors = useMemo(() => themeColors(isDark), [isDark]);
  const toast = useToast();
  const { requireVerified } = useEmailVerificationGuard();
  const refreshUser = useAuthStore((state) => state.refreshUser);

  const [profile, setProfile] = useState<any>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [privacy, setPrivacy] = useState<GalleryPrivacy>("public");
  const [completion, setCompletion] = useState<CompletionState>({
    percent: 0,
    completed: 0,
    total: 0,
    missingKeys: [],
  });
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");
  const [annualIncomeAmount, setAnnualIncomeAmount] = useState("");
  const [annualIncomeCurrency, setAnnualIncomeCurrency] = useState("USD");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [masterdata, setMasterdata] = useState<Record<string, any[]>>({});
  const [activeSingleField, setActiveSingleField] = useState<string | null>(null);
  const [activeMultiField, setActiveMultiField] = useState<string | null>(null);
  const [showIncomeCurrencySheet, setShowIncomeCurrencySheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const initialLoadStartedRef = useRef(false);

  const t = useCallback(
    (key: string, fallback?: string, options?: Record<string, any>) =>
      typeof translateText === "function" ? translateText(key, fallback, options) : fallback || key,
    [currentLanguage],
  );

  const fallbackText = useMemo(() => t("not_set", NOT_SET), [currentLanguage]);

  useEffect(() => {
    let cancelled = false;

    const loadMasterdata = async () => {
      const entries = await Promise.all(
        MASTER_TYPES.map(async (type) => {
          try {
            const response = await profileService.fetchMasterdata(type);
            return [type, response.data || []] as const;
          } catch {
            return [type, []] as const;
          }
        }),
      );

      if (!cancelled) setMasterdata(Object.fromEntries(entries));
    };

    void loadMasterdata();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadCompletion = useCallback(
    async (nextProfile: any = {}, nextGallery: GalleryItem[] = []) => {
      try {
        const response = await profileService.fetchProfileCompletion();
        const data = response.completion || response.profileCompletion || response.data;
        if (data) {
          setCompletion({
            percent: Number(data.percent ?? data.percentage ?? 0),
            completed: Number(data.completed ?? 0),
            total: Number(data.total ?? 0),
            missingKeys: Array.isArray(data.missingKeys)
              ? data.missingKeys
              : Array.isArray(data.missing)
                ? data.missing
                : [],
          });
          return;
        }
      } catch {
        // The local mirror keeps the page useful if the completion endpoint is unavailable.
      }

      setCompletion(localCompletion(nextProfile || {}, nextGallery || []));
    },
    [],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await profileService.fetchMe();
      const nextProfile = response.user?.profile || response.profile || {};
      const nextGallery = Array.isArray(nextProfile.gallery) ? nextProfile.gallery : [];
      setProfile(nextProfile);
      setGallery(nextGallery);
      setPrivacy(nextProfile.gallery_privacy || nextProfile.galleryPrivacy || "public");
      setHeadline(cleanProfileText(nextProfile.profile_headline || ""));
      setBio(cleanProfileMultilineText(nextProfile.bio || ""));
      setCompany(cleanProfileText(nextProfile.company || ""));
      setAnnualIncomeCurrency(nextProfile.annual_income?.currency || "USD");
      setAnnualIncomeAmount(nextProfile.annual_income?.amount ? formatAmount(String(nextProfile.annual_income.amount)) : "");
      await loadCompletion(nextProfile, nextGallery);
    } catch (error) {
      toast.show(apiMessage(String((error as any)?.message || ""), t("profile.load_error", "Could not load profile.")), "error");
    } finally {
      setLoading(false);
    }
  }, [loadCompletion]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadProfile();
  }, [loadProfile]);

  const primaryImage = useMemo(() => {
    const sortedGallery = [...gallery].sort((a, b) => {
      if (a.isPrimary === b.isPrimary) return (a.order || 0) - (b.order || 0);
      return a.isPrimary ? -1 : 1;
    });
    return sortedGallery[0]?.url || profileImage(profile) || PROFILE_PLACEHOLDER_IMAGE;
  }, [gallery, profile]);
  const primaryImageSource = useMemo(
    () => (typeof primaryImage === "string" ? { uri: primaryImage } : primaryImage),
    [primaryImage],
  );

  const age = useMemo(() => calculateAge(profile?.dob), [profile?.dob]);
  const displayName = profile?.profileName || profile?.profile_name || t("profile.my_profile", "My profile");

  const makeTranslatedOptions = useCallback(
    (values: readonly string[], namespace?: string): SelectOption[] =>
      values
        .map((value) => {
          const translated = namespace
            ? t(`${namespace}:${value}`, value.replace(/_/g, " "))
            : t(value, value.replace(/_/g, " "));
          return {
            value,
            label: formatProfileOptionLabel(translated, currentLanguage),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [currentLanguage],
  );

  const toMasterOptions = useCallback(
    (key: string): SelectOption[] =>
      (masterdata[key] || []).map((item: any) => ({
        value: item._id || item.value_id,
        label: formatProfileOptionLabel(item.label || item.name || item._id, currentLanguage),
        description: item.description,
        key: item.label || item.name,
      })),
    [currentLanguage, masterdata],
  );

  const fieldOptions = useMemo<Record<string, SelectOption[]>>(() => {
    const gender = String(profile?.gender || "").toLowerCase();
    const maritalOptions = [
      { value: "never_married", label: t("step_3.never_married", "Never married") },
      { value: "divorced", label: t("step_3.divorced", "Divorced") },
      { value: "separated", label: t("step_3.separated", "Separated") },
      { value: "widowed", label: t("step_3.widowed", "Widowed") },
      { value: "annulled", label: t("step_3.annulled", "Annulled") },
      { value: "married", label: t("step_3.married", "Married") },
    ].filter((option) => option.value !== "married" || gender === "male");
    const childrenOptions = [
      { value: "no_children", label: t("step_3.no_children", "No children") },
      { value: "has_children", label: t("step_3.has_children", "Has children") },
    ];
    const wantsChildrenOptions = [
      { value: "wants_children", label: t("step_3.wants_children", "Wants children") },
      { value: "does_not_want_children", label: t("step_3.does_not_want_children", "Does not want children") },
      { value: "open_to_have_children", label: t("step_3.open_to_have_children", "Open to have children") },
      { value: "no_preference", label: t("step_3.no_preference", "No preference") },
    ];
    const sectOptions = toMasterOptions("sect");
    const selectedSectKey = normalizeMasterKey(sectOptions.find((item) => item.value === fieldValueId(profile?.sect))?.key);
    const maslakOptionsRaw = toMasterOptions("maslak");
    const followingOptionsRaw = toMasterOptions("following");
    const sectFilters = SECT_FILTERS[selectedSectKey];

    return {
      nationality: makeTranslatedOptions(NATIONALITY_OPTIONS, "countries"),
      grew_up_in: makeTranslatedOptions(COUNTRY_OPTIONS, "countries"),
      mother_tongue: makeTranslatedOptions(LANGUAGE_OPTIONS, "languages"),
      languages_spoken: makeTranslatedOptions(LANGUAGE_OPTIONS, "languages"),
      born_muslim: [
        { value: "muslim_by_birth", label: t("step_2.muslim_by_birth", "Muslim by birth") },
        { value: "convert_revert", label: t("step_2.converted_reverted", "Convert / Revert") },
      ],
      i_usually_dress: [
        { value: "hijab", label: t("step_2.hijab", "Hijab") },
        { value: "jilbab_abaya_hijab", label: t("step_2.jilbab_abaya_hijab", "Jilbab / Abaya / Hijab") },
        { value: "hijab_niqab", label: t("step_2.hijab_niqab", "Hijab / Niqab") },
        { value: "modest_clothing", label: t("step_2.modest_clothing", "Modest clothing") },
        { value: "western_secular", label: t("step_2.western_secular", "Western / secular") },
        { value: "no_religious_dress", label: t("step_2.no_religious_dress", "No religious dress") },
      ],
      marital_status: maritalOptions,
      have_children: childrenOptions,
      wants_children: wantsChildrenOptions,
      marriage_plan: [
        { value: "as_soon_possible", label: t("step_3.as_soon_possible", "As soon as possible") },
        { value: "three_to_six_months", label: t("step_3.three_to_six_months", "3 to 6 months") },
        { value: "six_months_to_one_year", label: t("step_3.six_months_to_one_year", "6 months to 1 year") },
      ],
      relocation_plans: [
        { value: "open_to_relocate", label: t("step_3.open_to_relocate", "Open to relocate") },
        { value: "not_open_to_relocate", label: t("step_3.not_open_to_relocate", "Not open to relocate") },
        { value: "not_sure_yet", label: t("step_3.not_sure_yet", "Not sure yet") },
      ],
      height: toMasterOptions("height"),
      complexion: toMasterOptions("complexion"),
      ethnic_group: toMasterOptions("ethnic_group"),
      education: toMasterOptions("education"),
      occupation: toMasterOptions("occupation"),
      designation: toMasterOptions("designation"),
      sect: sectOptions,
      maslak: sectFilters
        ? maslakOptionsRaw.filter((item) => !item.key || sectFilters.maslak.includes(normalizeMasterKey(item.key)))
        : maslakOptionsRaw,
      following: sectFilters
        ? followingOptionsRaw.filter((item) => !item.key || sectFilters.following.includes(normalizeMasterKey(item.key)))
        : followingOptionsRaw,
      is_practising: [
        { value: "very_religious", label: t("step_6.very_religious", "Very religious") },
        { value: "religious", label: t("step_6.religious", "Religious / Practicing") },
        { value: "moderate", label: t("step_6.moderate", "Moderate") },
        { value: "liberal", label: t("step_6.liberal", "Liberal") },
        { value: "not_practicing", label: t("step_6.not_practicing", "Not practicing") },
        { value: "spiritual", label: t("step_6.spiritual", "Spiritual") },
      ],
      prayers: [
        { value: "five_times_daily", label: t("step_6.five_times_daily", "Five times daily") },
        { value: "most_prayers", label: t("step_6.most_prayers", "Most prayers") },
        { value: "some_prayers", label: t("step_6.some_prayers", "Some prayers") },
        { value: "friday_only", label: t("step_6.friday_only", "Friday only") },
        { value: "never_prays", label: t("step_6.never_prays", "Never prays") },
      ],
      smoking: [
        { value: "never_smoke", label: t("never_smoke", "Never smoke") },
        { value: "quit_smoking", label: t("quit_smoking", "Quit smoking") },
        { value: "occasionally_smokes", label: t("occasionally_smokes", "Occasionally smokes") },
        { value: "smokes_regularly", label: t("smokes_regularly", "Smokes regularly") },
        { value: "trying_to_quit", label: t("trying_to_quit", "Trying to quit") },
      ],
      alcohol: [
        { value: "never_drinks", label: t("never_drinks", "Never drinks alcohol") },
        { value: "drinks_alcohol", label: t("drinks_alcohol", "Drinks alcohol") },
        { value: "quit_alcohol", label: t("quit_alcohol", "Quit drinking") },
      ],
      profile_manager: PROFILE_MANAGER_OPTIONS.map((value) => ({ value, label: t(value, displayText(value)) })),
    };
  }, [makeTranslatedOptions, profile?.gender, profile?.sect, toMasterOptions]);

  const selectedSingleValue = useCallback((field: string) => fieldValueId(profile?.[field]), [profile]);
  const selectedMultiValue = useCallback((field: string) => fieldValueIds(profile?.[field]), [profile]);

  const currencyOptions: SelectOption[] = useMemo(
    () => ["USD", "EUR", "INR", "SAR", "AED", "AUD", "CAD", "QAR"].map((value) => ({ value, label: value })),
    [],
  );

  const rows = useMemo(() => {
    const female = String(profile?.gender || "").toLowerCase() === "female";
    const annualIncome = formatIncome(profile?.annual_income, fallbackText);

    const groups: Array<{ title: string; rows: FieldRow[] }> = [
      {
        title: t("profile.location", "Location"),
        rows: [
          {
            id: "current_location",
            label: t("profile.current_location", "Current location"),
            value: formatLocation(profile?.current_location, currentLanguage, fallbackText),
            completionKey: "current_location",
            icon: MapPin,
          },
          {
            id: "nationality",
            label: t("profile.nationality", "Nationality"),
            value: formatList(profile?.nationality, fallbackText),
            completionKey: "nationality",
            icon: Flag,
          },
          {
            id: "grew_up_in",
            label: t("profile.grew_up_in", "Grew up in"),
            value: formatSelect(profile?.grew_up_in, fallbackText),
            completionKey: "grew_up_in",
            icon: Flag,
          },
        ],
      },
      {
        title: t("profile.personal_background", "Personal and cultural background"),
        rows: [
          {
            id: "mother_tongue",
            label: t("profile.mother_tongue", "Mother tongue"),
            value: formatSelect(profile?.mother_tongue, fallbackText),
            completionKey: "mother_tongue",
            icon: Languages,
          },
          {
            id: "languages_spoken",
            label: t("profile.languages_spoken", "Languages spoken"),
            value: formatList(profile?.languages_spoken, fallbackText),
            completionKey: "languages_spoken",
            icon: Languages,
          },
          {
            id: "born_muslim",
            label: t("profile.born_muslim", "Born Muslim"),
            value: formatSelect(profile?.born_muslim, fallbackText),
            completionKey: "born_muslim",
            icon: ShieldCheck,
          },
          ...(female
            ? [
                {
                  id: "i_usually_dress",
                  label: t("profile.i_usually_dress", "How do you usually dress?"),
                  value: formatSelect(profile?.i_usually_dress, fallbackText),
                  completionKey: "i_usually_dress",
                  icon: Sparkles,
                } satisfies FieldRow,
              ]
            : []),
        ],
      },
      {
        title: t("profile.appearance", "Appearance"),
        rows: [
          {
            id: "height",
            label: t("profile.height", "Height"),
            value: displayText(String(profile?.height || "")) || fallbackText,
            completionKey: "height",
            icon: Ruler,
          },
          {
            id: "complexion",
            label: t("profile.complexion", "Complexion"),
            value: formatSelect(profile?.complexion, fallbackText),
            completionKey: "complexion",
            icon: Palette,
          },
          {
            id: "ethnic_group",
            label: t("profile.ethnic_group", "Ethnic group"),
            value: formatSelect(profile?.ethnic_group, fallbackText),
            completionKey: "ethnic_group",
            icon: Users,
          },
        ],
      },
      {
        title: t("profile.relationship_status", "Relationship status"),
        rows: [
          {
            id: "marital_status",
            label: t("profile.marital_status", "Marital status"),
            value: formatSelect(profile?.marital_status, fallbackText),
            completionKey: "marital_status",
            icon: Heart,
          },
          {
            id: "have_children",
            label: t("profile.have_children", "Have children"),
            value: formatSelect(profile?.have_children, fallbackText),
            completionKey: "have_children",
            icon: Baby,
          },
          {
            id: "wants_children",
            label: t("profile.wants_children", "Wants children"),
            value: formatSelect(profile?.wants_children, fallbackText),
            completionKey: "wants_children",
            icon: Baby,
          },
        ],
      },
      {
        title: t("profile.future_plans", "Future plans"),
        rows: [
          {
            id: "marriage_plan",
            label: t("profile.marriage_plan", "Marriage plan"),
            value: formatSelect(profile?.marriage_plan, fallbackText),
            completionKey: "marriage_plan",
            icon: Calendar,
          },
          {
            id: "relocation_plans",
            label: t("profile.relocation_plans", "Relocation plans"),
            value: formatSelect(profile?.relocation_plans, fallbackText),
            completionKey: "relocation_plans",
            icon: Plane,
          },
        ],
      },
      {
        title: t("profile.professional_info", "Professional info"),
        rows: [
          {
            id: "education",
            label: t("profile.education", "Education"),
            value: formatSelect(profile?.education, fallbackText),
            completionKey: "education",
            icon: GraduationCap,
          },
          {
            id: "occupation",
            label: t("profile.occupation", "Occupation"),
            value: formatSelect(profile?.occupation, fallbackText),
            completionKey: "occupation",
            icon: Briefcase,
          },
          {
            id: "designation",
            label: t("profile.designation", "Designation"),
            value: formatSelect(profile?.designation, fallbackText),
            icon: Briefcase,
          },
          {
            id: "company",
            label: t("profile.company", "Company"),
            value: company || fallbackText,
            completionKey: "company",
            icon: Building2,
          },
          {
            id: "annual_income",
            label: t("profile.annual_income", "Annual income"),
            value: annualIncome,
            completionKey: "annual_income",
            icon: Banknote,
          },
        ],
      },
      {
        title: t("profile.religious_beliefs", "Religious beliefs"),
        rows: [
          {
            id: "sect",
            label: t("profile.sect", "Sect"),
            value: formatSelect(profile?.sect, fallbackText),
            completionKey: "sect",
            icon: MoonStar,
          },
          {
            id: "maslak",
            label: t("profile.maslak", "Maslak / School of thought"),
            value: formatSelect(profile?.maslak, fallbackText),
            completionKey: "maslak",
            icon: MoonStar,
          },
          {
            id: "following",
            label: t("profile.following", "Following / Movement"),
            value: formatSelect(profile?.following, fallbackText),
            icon: MoonStar,
          },
          {
            id: "is_practising",
            label: t("profile.is_practising", "How practising are you?"),
            value: formatSelect(profile?.is_practising, fallbackText),
            completionKey: "is_practising",
            icon: MoonStar,
          },
          {
            id: "prayers",
            label: t("profile.prayers", "Prayer habit"),
            value: formatSelect(profile?.prayers, fallbackText),
            completionKey: "prayers",
            icon: MoonStar,
          },
        ],
      },
      {
        title: t("profile.lifestyle", "Lifestyle"),
        rows: [
          {
            id: "smoking",
            label: t("profile.smoking", "Smoking"),
            value: formatSelect(profile?.smoking, fallbackText),
            completionKey: "smoking",
            icon: Cigarette,
          },
          {
            id: "alcohol",
            label: t("profile.alcohol", "Alcohol"),
            value: formatSelect(profile?.alcohol, fallbackText),
            completionKey: "alcohol",
            icon: Wine,
          },
        ],
      },
    ];

    return groups;
  }, [company, currentLanguage, fallbackText, profile]);

  const rowById = useMemo(() => {
    const map = new Map<string, FieldRow>();
    rows.forEach((section) => section.rows.forEach((row) => map.set(row.id, row)));
    return map;
  }, [rows]);

  const activeSingleOptions = activeSingleField ? fieldOptions[activeSingleField] || [] : [];
  const activeMultiOptions: MultiSelectOption[] = activeMultiField ? fieldOptions[activeMultiField] || [] : [];
  const activeSingleTitle = activeSingleField ? rowById.get(activeSingleField)?.label || "" : "";
  const activeMultiTitle = activeMultiField ? rowById.get(activeMultiField)?.label || "" : "";
  const activeMultiMax = activeMultiField === "nationality" || activeMultiField === "ethnic_group" ? 2 : 5;

  const onGalleryChange = useCallback(
    (payload: { gallery: GalleryItem[]; privacy: GalleryPrivacy; avatarUuid?: string | null }) => {
      const nextGallery = payload.gallery;
      const nextPrivacy = payload.privacy;
      setGallery(nextGallery);
      setPrivacy(nextPrivacy);
      setProfile((current: any) => ({
        ...(current || {}),
        gallery: nextGallery,
        gallery_privacy: nextPrivacy,
        avatar: nextGallery.find((item) => item.isPrimary) || nextGallery[0] || current?.avatar,
      }));
      void loadCompletion(profile, nextGallery);
    },
    [loadCompletion, profile],
  );

  const validateInlineFields = () => {
    const nextErrors: Record<string, string> = {};
    const cleanedHeadline = cleanHeadlineTextForSave(headline);
    const cleanedBio = cleanProfileTextForSave(bio);
    const cleanedCompany = cleanHeadlineTextForSave(company);
    const incomeAmount = parseAmount(annualIncomeAmount);
    const headlineError =
      cleanedHeadline && (!isAllowedProfileText(cleanedHeadline) || countNonSpace(cleanedHeadline) > HEADLINE_MAX)
        ? t("profile.invalid_headline", "Use a shorter headline without links or unsupported characters.")
        : "";
    const bioError =
      cleanedBio && (!isAllowedProfileText(cleanedBio) || countNonSpace(cleanedBio) > BIO_MAX)
        ? t("profile.invalid_bio", "Use a shorter bio without links or unsupported characters.")
        : "";
    const companyError =
      cleanedCompany && (!isAllowedProfileText(cleanedCompany) || countNonSpace(cleanedCompany) > COMPANY_MAX)
        ? t("profile.invalid_company", "Use a shorter company name without links or unsupported characters.")
        : "";
    const incomeError =
      annualIncomeAmount.trim() &&
      (!Number.isFinite(incomeAmount) || incomeAmount <= 0 || incomeAmount > MAX_INCOME)
        ? t("annual_income_invalid", "Please enter a valid annual income amount.")
        : "";

    if (headlineError) nextErrors.headline = headlineError;
    if (bioError) nextErrors.bio = bioError;
    if (companyError) nextErrors.company = companyError;
    if (incomeError) nextErrors.annualIncome = incomeError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveInlineFields = () => {
    if (!requireVerified("save")) return;
    void (async () => {
      if (!validateInlineFields()) return;
      setSaving(true);
      try {
        const incomeAmount = parseAmount(annualIncomeAmount);
        const payload = {
          profile_headline: cleanHeadlineTextForSave(headline),
          bio: cleanProfileTextForSave(bio),
          company: cleanHeadlineTextForSave(company),
          ...(annualIncomeAmount.trim() && Number.isFinite(incomeAmount) && incomeAmount > 0
            ? { annual_income: { currency: annualIncomeCurrency, amount: incomeAmount } }
            : {}),
        };
        const response = await profileService.updateProfile(payload);
        const nextProfile = response.profile || response.user?.profile || { ...(profile || {}), ...payload };
        setProfile(nextProfile);
        await refreshUser();
        await loadCompletion(nextProfile, gallery);
        toast.show(t("profile.profile_updated", "Profile updated."), "success");
      } catch (error) {
        toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
      } finally {
        setSaving(false);
      }
    })();
  };

  const mergeUpdatedProfile = useCallback(
    async (payload: Record<string, any>, responseProfile?: any) => {
      const nextProfile = responseProfile || { ...(profile || {}), ...payload };
      setProfile(nextProfile);
      await refreshUser();
      await loadCompletion(nextProfile, gallery);
    },
    [gallery, loadCompletion, profile, refreshUser],
  );

  const saveFieldPayload = useCallback(
    async (field: string, payload: Record<string, any>) => {
      if (!requireVerified("save")) return false;
      setSavingField(field);
      try {
        const response = await profileService.updateProfile(payload);
        await mergeUpdatedProfile(payload, response.profile || response.user?.profile);
        toast.show(t("profile.profile_updated", "Profile updated."), "success");
        return true;
      } catch (error) {
        toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
        return false;
      } finally {
        setSavingField(null);
      }
    },
    [mergeUpdatedProfile, requireVerified, toast],
  );

  const buildLocalMasterValue = useCallback(
    (field: string, valueId: string) => {
      const option = fieldOptions[field]?.find((item) => item.value === valueId);
      return { value_id: valueId, label: option?.key || option?.label || valueId };
    },
    [fieldOptions],
  );

  const handleSingleSelect = useCallback(
    (field: string, value: string) => {
      const payload: Record<string, any> = MASTER_FIELDS.has(field)
        ? { [field]: { value_id: value } }
        : { [field]: value };

      if (field === "sect") {
        payload.maslak = "";
        payload.following = "";
      }

      const localPayload: Record<string, any> = MASTER_FIELDS.has(field)
        ? { [field]: buildLocalMasterValue(field, value) }
        : { [field]: value };

      if (field === "sect") {
        localPayload.maslak = "";
        localPayload.following = "";
      }

      void saveFieldPayload(field, payload).then((saved) => {
        if (saved) setProfile((current: any) => ({ ...(current || {}), ...localPayload }));
      });
    },
    [buildLocalMasterValue, saveFieldPayload],
  );

  const handleMultiSelect = useCallback(
    (field: string, values: string[]) => {
      const payload = MASTER_FIELDS.has(field)
        ? { [field]: values.map((value) => ({ value_id: value })) }
        : { [field]: values };
      const localPayload = MASTER_FIELDS.has(field)
        ? { [field]: values.map((value) => buildLocalMasterValue(field, value)) }
        : { [field]: values };

      void saveFieldPayload(field, payload).then((saved) => {
        if (saved) setProfile((current: any) => ({ ...(current || {}), ...localPayload }));
      });
    },
    [buildLocalMasterValue, saveFieldPayload],
  );

  const refreshCurrentLocation = useCallback(async () => {
    if (!requireVerified("save")) return;

    setSavingField("current_location");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        toast.show(
          t("location_permission_required", "Location permission is required to fill your current city."),
          "error",
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        toast.show(
          t("device_location_services_disabled", "Please turn on device location services and try again."),
          "error",
        );
        return;
      }

      let position: Location.LocationObject | null = null;
      try {
        position = await withLocationTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        );
      } catch {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 5000,
        });
      }

      if (!position) {
        toast.show(
          t("device_location_unavailable", "Could not get your device location. Please enable location services and try again."),
          "error",
        );
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const reverseResponse = await profileService.fetchPlaceReverse(lat, lng, normalizeLanguage(currentLanguage));

      if (!reverseResponse.success || !hasResolvedLocation(reverseResponse.data)) {
        const messageKey =
          reverseResponse.message === "network_error"
            ? "location_backend_network_error"
            : reverseResponse.status === 404 || reverseResponse.message === "invalid_json"
              ? "location_backend_unavailable"
              : "location_resolve_failed";
        toast.show(
          t(messageKey, "Could not resolve your city from this location. Please try again."),
          "error",
        );
        return;
      }

      const details = reverseResponse.data as PlaceDetails;
      const payload = {
        current_location: {
          place_id: details.place_id,
          country: String(details.countryCode || "").toUpperCase(),
          ...(details.state ? { state: details.state.trim() } : {}),
          city: String(details.city || "").trim(),
          geo: {
            type: "Point",
            coordinates: [Number(details.lng), Number(details.lat)],
          },
        },
      };

      const response = await profileService.updateProfile(payload);
      await mergeUpdatedProfile(payload, response.profile || response.user?.profile);
      toast.show(t("profile.profile_updated", "Profile updated."), "success");
    } catch (error) {
      toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
    } finally {
      setSavingField(null);
    }
  }, [currentLanguage, mergeUpdatedProfile, requireVerified, toast]);

  const openFieldEditor = (row: FieldRow) => {
    if (row.id === "current_location") {
      toast.show(
        t("profile.location_edit_from_device", "Location editing will use your device location. We will open this as a dedicated edit screen."),
        "info",
      );
      return;
    }

    if (row.id === "annual_income" || row.id === "company") {
      toast.show(t("profile.edit_inline_above", "Use the editable section above to update this field."), "info");
      return;
    }

    if (!fieldOptions[row.id]?.length) {
      toast.show(t("profile.field_editor_unavailable", "Options are still loading. Please try again."), "info");
      return;
    }

    if (["nationality", "languages_spoken", "ethnic_group"].includes(row.id)) {
      setActiveMultiField(row.id);
      return;
    }

    setActiveSingleField(row.id);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBackTitleBar title={t("edit_profile", "Edit profile")} fallbackHref="/(tabs)/profile" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingHorizontal: scale(20) }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Image source={primaryImageSource as any} style={styles.avatar} contentFit="cover" />
        <View style={styles.summaryBody}>
          <View style={[styles.nameRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {displayName}
              {age ? `, ${age}` : ""}
            </Text>
            {profile?.isVerified ? <ShieldCheck size={18} color={colors.primary} /> : null}
          </View>
          <Text style={[styles.summaryMeta, { color: colors.muted }]}>
            {completion.percent}% {t("profile.profile_completed", "profile completed")}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${Math.min(100, completion.percent)}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <EditProfileMediaEditor
        canUsePrivateGallery={String(profile?.gender || "").toLowerCase() === "female"}
        initialGallery={gallery}
        initialPrivacy={privacy}
        onGalleryChange={onGalleryChange}
      />

      <View style={[styles.inlineCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t("profile.profile_summary", "Profile summary")}
        </Text>
        <TextInput
          value={headline}
          onChangeText={(value) => {
            setHeadline(value);
            if (errors.headline) setErrors((current) => ({ ...current, headline: "" }));
          }}
          placeholder={t("profile.headline_placeholder", "Write a headline for this profile")}
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        maxLength={80}
        />
        <Text style={[styles.counter, { color: colors.muted }]}>{headline.length}/80</Text>
        {errors.headline ? <Text style={styles.error}>{errors.headline}</Text> : null}

        <TextInput
          value={bio}
          onChangeText={(value) => {
            setBio(value);
            if (errors.bio) setErrors((current) => ({ ...current, bio: "" }));
          }}
          placeholder={t("profile.bio_placeholder", "Share brief description to help others understand you better.")}
          placeholderTextColor={colors.muted}
          style={[styles.textarea, { borderColor: colors.border, color: colors.text }]}
          multiline
          maxLength={BIO_MAX}
          textAlignVertical="top"
        />
        <Text style={[styles.counter, { color: colors.muted }]}>{bio.length}/{BIO_MAX}</Text>
        {errors.bio ? <Text style={styles.error}>{errors.bio}</Text> : null}

        <TextInput
          value={company}
          onChangeText={(value) => {
            setCompany(value);
            if (errors.company) setErrors((current) => ({ ...current, company: "" }));
          }}
          placeholder={t("profile.company", "Company")}
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          maxLength={80}
        />
        {errors.company ? <Text style={styles.error}>{errors.company}</Text> : null}

        <View style={styles.incomeRow}>
          <Pressable
            onPress={() => setShowIncomeCurrencySheet(true)}
            style={[styles.currencyButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.currencyText, { color: colors.text }]}>{annualIncomeCurrency}</Text>
          </Pressable>
          <TextInput
            value={annualIncomeAmount}
            onChangeText={(value) => {
              setAnnualIncomeAmount(formatAmount(value));
              if (errors.annualIncome) setErrors((current) => ({ ...current, annualIncome: "" }));
            }}
            placeholder={t("amount", "Amount")}
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={[styles.incomeInput, { borderColor: colors.border, color: colors.text }]}
            maxLength={12}
          />
        </View>
        {errors.annualIncome ? <Text style={styles.error}>{errors.annualIncome}</Text> : null}

        <GradientButton
          title={t("save", "Save")}
          onPress={saveInlineFields}
          loading={saving}
          containerStyle={styles.saveButton}
          widthMode="full"
        />
      </View>

      {rows.map((section) => (
        <View key={section.title} style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          {section.rows.map((row) => {
            const Icon = row.icon;
            const missing = row.completionKey ? completion.missingKeys.includes(row.completionKey) : false;
            const gain = gainFor(completion, row.completionKey);

            return (
              <Pressable
                key={row.id}
                onPress={() => openFieldEditor(row)}
                disabled={Boolean(savingField)}
                style={[styles.row, isRTL && styles.rowReverse]}
              >
                <View style={[styles.iconCircle, { backgroundColor: isDark ? colors.card : "#FFF0F4" }]}>
                  <Icon size={20} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.rowContent}>
                  <View style={[styles.rowTop, isRTL && styles.rowReverse]}>
                    <Text style={[styles.rowLabel, { color: colors.muted }]}>{row.label}</Text>
                    {gain ? (
                      <Text style={[styles.gain, { color: colors.primary }]}>+{gain}%</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.rowValue,
                      { color: missing ? colors.muted : colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                </View>
                {savingField === row.id ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <ChevronRight
                    size={18}
                    color={colors.muted}
                    style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={{ height: 24 }} />

      <SingleSelectSheet
        visible={Boolean(activeSingleField)}
        onClose={() => setActiveSingleField(null)}
        onSelect={(value) => {
          if (activeSingleField) handleSingleSelect(activeSingleField, value);
        }}
        options={activeSingleOptions}
        selected={activeSingleField ? selectedSingleValue(activeSingleField) : undefined}
        title={activeSingleTitle}
        searchEnabled={activeSingleOptions.length > 8}
      />

      <SingleSelectSheet
        visible={showIncomeCurrencySheet}
        onClose={() => setShowIncomeCurrencySheet(false)}
        onSelect={setAnnualIncomeCurrency}
        options={currencyOptions}
        selected={annualIncomeCurrency}
        title={t("select_currency", "Select currency")}
      />

      <MultiSelectSheet
        visible={Boolean(activeMultiField)}
        onClose={() => setActiveMultiField(null)}
        onConfirm={(values) => {
          if (activeMultiField) handleMultiSelect(activeMultiField, values);
        }}
        options={activeMultiOptions}
        selected={activeMultiField ? selectedMultiValue(activeMultiField) : []}
        title={activeMultiTitle}
        maxSelections={activeMultiMax}
        searchEnabled
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  container: {
    paddingBottom: 112,
    paddingTop: 16,
  },
  summary: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  avatar: {
    borderRadius: 32,
    height: 64,
    width: 64,
  },
  summaryBody: {
    flex: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontFamily: Typography.font.heading.bold,
    fontWeight: "700",
    lineHeight: 24,
  },
  summaryMeta: {
    fontSize: 13,
    fontFamily: Typography.font.body.medium,
    fontWeight: "500",
    marginTop: 3,
  },
  progressTrack: {
    borderRadius: 999,
    height: 6,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: 999,
    height: "100%",
  },
  inlineCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  section: {
    borderTopWidth: 1,
    marginTop: 22,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Typography.font.heading.bold,
    fontWeight: "700",
    letterSpacing: 3,
    lineHeight: 20,
    marginBottom: 14,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  textarea: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    minHeight: 132,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: 12,
    marginTop: 4,
  },
  error: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
  },
  incomeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  currencyButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 14,
    width: 92,
  },
  currencyText: {
    fontSize: 15,
    fontFamily: Typography.font.body.semi,
    fontWeight: "600",
  },
  incomeInput: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  saveButton: {
    marginTop: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 66,
    paddingVertical: 10,
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  rowLabel: {
    flex: 1,
    fontSize: 11,
    fontFamily: Typography.font.body.bold,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  gain: {
    fontSize: 12,
    fontFamily: Typography.font.body.bold,
    fontWeight: "700",
  },
  rowValue: {
    fontSize: 15,
    fontFamily: Typography.font.body.semi,
    fontWeight: "600",
    lineHeight: 21,
  },
});
