"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
    Compass, 
    Plus, 
    Search, 
    Calendar, 
    ChevronLeft, 
    ChevronRight, 
    FileText, 
    CheckCircle2, 
    AlertTriangle, 
    Sparkles, 
    Brain, 
    PlusCircle, 
    Trash2, 
    Edit3, 
    Archive, 
    MoreVertical, 
    Star, 
    BookOpen, 
    Link2, 
    Loader2, 
    Folder, 
    Layers, 
    Activity, 
    Target,
    LayoutGrid,
    Smile,
    HelpCircle,
    X,
    TrendingUp,
    Lock,
    Unlock
} from "lucide-react";
import { CEOSidebar } from "@/components/ceo-sidebar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Idea {
    id: string;
    title: string;
    content: string;
    category: 'Marketing' | 'Courses' | 'Operations' | 'Finance' | 'Technology' | 'Staff' | 'Students' | 'General';
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    status: 'Inbox' | 'Planning' | 'Executing' | 'Completed' | 'Archived';
    tags: string[];
    created_at: string;
}

interface MonthlyPlan {
    id: string;
    month: number;
    year: number;
    objective: string;
    marketing: string;
    academics: string;
    operations: string;
    finance: string;
    events: string;
    challenges: string;
    notes: string;
    completion: number;
    is_locked?: boolean;
}

interface StrategicProject {
    id: string;
    title: string;
    description: string;
    status: 'Planning' | 'Research' | 'Development' | 'Testing' | 'Completed';
    progress: number;
    deadline: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface BusinessJournal {
    id: string;
    entry_date: string;
    wins: string;
    problems: string;
    ideas: string;
    lessons: string;
    tomorrow_focus: string;
}

interface DecisionLog {
    id: string;
    title: string;
    reason: string;
    expected_outcome: string;
    actual_outcome: string;
    decision_date: string;
    review_date: string;
    status: 'Pending Review' | 'Successful' | 'Needs Improvement';
}

interface VisionCard {
    id: string;
    title: string;
    description: string;
    image_url?: string;
    target_year: number;
    display_order: number;
}

interface Resource {
    id: string;
    title: string;
    category: 'Documents' | 'Images' | 'PDFs' | 'Useful Links' | 'Notes';
    file_url?: string;
    notes?: string;
}

type TabType = "focus-vision" | "ideas" | "projects" | "plans" | "journals" | "resources";

const TAB_QUOTES: Record<TabType, { text: string; author: string }> = {
    "focus-vision": {
        text: "The best way to predict the future is to create it.",
        author: "Peter Drucker"
    },
    "ideas": {
        text: "Ideas are easy. Implementation is hard.",
        author: "Guy Kawasaki"
    },
    "plans": {
        text: "Good plans shape good decisions. That is why planning helps to make elusive dreams come true.",
        author: "Lester R. Bittel"
    },
    "projects": {
        text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
        author: "Alexander Graham Bell"
    },
    "journals": {
        text: "Journaling is like whispering to one's self and listening at the same time.",
        author: "Mina Murray"
    },
    "resources": {
        text: "Information is the oil of the 21st century, and analytics is the combustion engine.",
        author: "Peter Sondergaard"
    }
};

export default function StrategyOfficePage() {
    const { profile, userRole, loading: authLoading } = useAuth();
    const router = useRouter();

    // Navigation and UX states
    const [activeTab, setActiveTab] = useState<TabType>("focus-vision");
    const [globalSearch, setGlobalSearch] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    
    // Core data states
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [projects, setProjects] = useState<StrategicProject[]>([]);
    const [visionCards, setVisionCards] = useState<VisionCard[]>([]);
    const [decisions, setDecisions] = useState<DecisionLog[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    
    // Planner states (Month/Year picker)
    const [currentPlannerMonth, setCurrentPlannerMonth] = useState(new Date().getMonth() + 1);
    const [currentPlannerYear, setCurrentPlannerYear] = useState(new Date().getFullYear());
    const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
    const [allYearPlans, setAllYearPlans] = useState<MonthlyPlan[]>([]);
    const [annualVision, setAnnualVision] = useState("Expand global awareness of Usthad Academy courses.");

    // Journal states (Date picker)
    const [journalDate, setJournalDate] = useState(new Date().toISOString().split("T")[0]);
    const [journalEntry, setJournalEntry] = useState<BusinessJournal | null>(null);

    // Executive Focus state
    const [focusData, setFocusData] = useState({
        todayFocus: "Loading...",
        monthlyGoal: "Loading...",
        yearGoal: "Loading...",
        reviewDate: "Loading..."
    });

    // Modals visibility
    const [modalType, setModalType] = useState<"idea" | "project" | "decision" | "vision" | "resource" | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);

    // Form inputs state (for modals)
    const [ideaForm, setIdeaForm] = useState({
        title: "", description: "", category: "General", priority: "Medium", tags: ""
    });
    const [projectForm, setProjectForm] = useState({
        title: "", description: "", status: "Planning", progress: 0, deadline: "", priority: "Medium"
    });
    const [decisionForm, setDecisionForm] = useState({
        title: "", reason: "", expected_outcome: "", actual_outcome: "", decision_date: "", review_date: "", status: "Pending Review"
    });
    const [visionForm, setVisionForm] = useState({
        title: "", description: "", image_url: "", target_year: new Date().getFullYear(), display_order: 0
    });
    const [resourceForm, setResourceForm] = useState({
        title: "", category: "Notes", file_url: "", notes: ""
    });

    // Guard Check
    const isAuthorized = profile?.role === "ceo" || userRole === "CEO";

    // Fetch Focus Data (special monthly plan coordinates month=0, year=0)
    const fetchFocusData = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("monthly_plans")
                .select("*")
                .eq("user_id", userId)
                .eq("month", 0)
                .eq("year", 0)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setFocusData({
                    todayFocus: data.objective || "Focus on courses optimization",
                    monthlyGoal: data.marketing || "Expand target audience",
                    yearGoal: data.academics || "Secure 5,000 active enrollments",
                    reviewDate: data.events || "15 July"
                });
            } else {
                // Initialize default Focus Data
                const defaultFocus = {
                    user_id: userId,
                    month: 0,
                    year: 0,
                    objective: "Improve Student Admissions",
                    marketing: "Launch New Marketing Campaign",
                    academics: "Expand Academy Operations",
                    events: "15 July",
                    completion: 0
                };
                await supabase.from("monthly_plans").insert([defaultFocus]);
                setFocusData({
                    todayFocus: defaultFocus.objective,
                    monthlyGoal: defaultFocus.marketing,
                    yearGoal: defaultFocus.academics,
                    reviewDate: defaultFocus.events
                });
            }
        } catch (e: any) {
            console.error("Focus load failure:", e.message);
        }
    }, []);

    // Save Focus Data helper
    const saveFocusData = async (updatedFields: Partial<typeof focusData>) => {
        if (!profile?.id) return;
        const newFocus = { ...focusData, ...updatedFields };
        setFocusData(newFocus); // Optimistic

        try {
            await supabase
                .from("monthly_plans")
                .upsert({
                    user_id: profile.id,
                    month: 0,
                    year: 0,
                    objective: newFocus.todayFocus,
                    marketing: newFocus.monthlyGoal,
                    academics: newFocus.yearGoal,
                    events: newFocus.reviewDate,
                    completion: 100
                }, { onConflict: "user_id,month,year" });
        } catch (e: any) {
            toast.error("Failed to auto-save focus fields");
        }
    };

    // Fetch Monthly Plan helper
    const fetchMonthlyPlan = useCallback(async (userId: string, m: number, y: number) => {
        try {
            const { data, error } = await supabase
                .from("monthly_plans")
                .select("*")
                .eq("user_id", userId)
                .eq("month", m)
                .eq("year", y)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setMonthlyPlan(data);
            } else {
                setMonthlyPlan({
                    id: "",
                    month: m,
                    year: y,
                    objective: "",
                    marketing: "",
                    academics: "",
                    operations: "",
                    finance: "",
                    events: "",
                    challenges: "",
                    notes: "",
                    completion: 0,
                    is_locked: false
                });
            }
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    // Save Monthly Plan (Auto-save, debounced)
    const saveMonthlyPlanField = async (field: keyof MonthlyPlan, value: any) => {
        if (!profile?.id || !monthlyPlan) return;
        
        const updated = { ...monthlyPlan, [field]: value };
        setMonthlyPlan(updated); // Optimistic UI

        try {
            const payload = {
                user_id: profile.id,
                month: currentPlannerMonth,
                year: currentPlannerYear,
                objective: updated.objective,
                marketing: updated.marketing,
                academics: updated.academics,
                operations: updated.operations,
                finance: updated.finance,
                events: updated.events,
                challenges: updated.challenges,
                notes: updated.notes,
                completion: updated.completion,
                is_locked: updated.is_locked
            };

            await supabase
                .from("monthly_plans")
                .upsert(payload, { onConflict: "user_id,month,year" });
        } catch (e: any) {
            console.error("Auto-save failed:", e.message);
        }
    };

    // Fetch Daily Journal Entry helper
    const fetchJournalEntry = useCallback(async (userId: string, dateStr: string) => {
        try {
            const { data, error } = await supabase
                .from("business_journal")
                .select("*")
                .eq("user_id", userId)
                .eq("entry_date", dateStr)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setJournalEntry(data);
            } else {
                setJournalEntry({
                    id: "",
                    entry_date: dateStr,
                    wins: "",
                    problems: "",
                    ideas: "",
                    lessons: "",
                    tomorrow_focus: ""
                });
            }
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    // Save Journal Entry (Auto-save)
    const saveJournalField = async (field: keyof BusinessJournal, value: any) => {
        if (!profile?.id || !journalEntry) return;

        const updated = { ...journalEntry, [field]: value };
        setJournalEntry(updated); // Optimistic UI

        try {
            await supabase
                .from("business_journal")
                .upsert({
                    user_id: profile.id,
                    entry_date: journalDate,
                    wins: updated.wins,
                    problems: updated.problems,
                    ideas: updated.ideas,
                    lessons: updated.lessons,
                    tomorrow_focus: updated.tomorrow_focus
                }, { onConflict: "user_id,entry_date" });
        } catch (e: any) {
            console.error("Journal auto-save error:", e.message);
        }
    };

    // Main Data Loader
    const loadAllData = useCallback(async (userId: string) => {
        setLoadingData(true);
        try {
            // 1. Fetch Ideas
            const { data: ideasData } = await supabase
                .from("ideas")
                .select("*")
                .eq("created_by", userId)
                .order("created_at", { ascending: false });
            setIdeas(ideasData || []);

            // 2. Fetch Projects
            const { data: projData } = await supabase
                .from("strategic_projects")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            setProjects(projData || []);

            // 3. Fetch Vision Board Cards
            const { data: visData } = await supabase
                .from("vision_board")
                .select("*")
                .eq("user_id", userId)
                .order("display_order", { ascending: true });
            setVisionCards(visData || []);

            // 4. Fetch Decision Log
            const { data: decData } = await supabase
                .from("decision_log")
                .select("*")
                .eq("user_id", userId)
                .order("decision_date", { ascending: false });
            setDecisions(decData || []);

            // 5. Fetch Resources
            const { data: resData } = await supabase
                .from("resources")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            setResources(resData || []);

            // 6. Fetch all Monthly plans of current year (for Year Planner progress averages)
            const { data: yearPlans } = await supabase
                .from("monthly_plans")
                .select("*")
                .eq("user_id", userId)
                .eq("year", currentPlannerYear)
                .neq("month", 0); // exclude config focus
            setAllYearPlans(yearPlans || []);

            // Load today's focus & default plans
            await fetchFocusData(userId);
            await fetchMonthlyPlan(userId, currentPlannerMonth, currentPlannerYear);
            await fetchJournalEntry(userId, journalDate);

        } catch (err: any) {
            console.error("Data load failure:", err.message);
            toast.error("Failed to load strategy details");
        } finally {
            setLoadingData(false);
        }
    }, [currentPlannerMonth, currentPlannerYear, journalDate, fetchFocusData, fetchMonthlyPlan, fetchJournalEntry]);

    // Initialize & Authentication Guard
    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Access restricted: CEO credentials required.");
            router.replace("/ceo");
            return;
        }

        if (profile?.id) {
            loadAllData(profile.id);
        }
    }, [profile, authLoading, isAuthorized, router, loadAllData]);

    // Keyboard Shortcuts hooks
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
                e.preventDefault();
                setModalType("idea");
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
                e.preventDefault();
                setActiveTab("journals");
                setTimeout(() => {
                    const el = document.getElementById("journal-wins-input");
                    if (el) el.focus();
                }, 100);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
                e.preventDefault();
                setModalType("project");
            }
            if (e.key === "Escape") {
                setModalType(null);
                setEditingItem(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Add / Edit Idea Handler
    const handleSaveIdea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        try {
            const tagsArray = ideaForm.tags.split(",").map(t => t.trim()).filter(Boolean);
            const payload = {
                created_by: profile.id,
                title: ideaForm.title,
                content: ideaForm.description,
                category: ideaForm.category as any,
                priority: ideaForm.priority as any,
                tags: tagsArray
            };

            if (editingItem) {
                // Update
                const { error } = await supabase
                    .from("ideas")
                    .update(payload)
                    .eq("id", editingItem.id);
                if (error) throw error;
                toast.success("Idea modified successfully");
            } else {
                // Insert
                const { error } = await supabase
                    .from("ideas")
                    .insert([{ ...payload, status: "Inbox" }]);
                if (error) throw error;
                toast.success("New idea captured!");
            }

            setModalType(null);
            setEditingItem(null);
            setIdeaForm({ title: "", description: "", category: "General", priority: "Medium", tags: "" });
            loadAllData(profile.id);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Drag-and-drop status update for Kanban Board
    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("text/plain", id);
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: Idea["status"]) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text");
        if (!id || !profile?.id) return;

        // Optimistic UI updates
        const updatedIdeas = ideas.map(idea => idea.id === id ? { ...idea, status: targetStatus } : idea);
        setIdeas(updatedIdeas);

        try {
            const { error } = await supabase
                .from("ideas")
                .update({ status: targetStatus, updated_at: new Date().toISOString() })
                .eq("id", id);
            
            if (error) throw error;
        } catch (err: any) {
            toast.error("Failed to move card in Kanban");
            loadAllData(profile.id);
        }
    };

    // Delete Item trigger
    const handleDeleteItem = async (table: string, id: string) => {
        if (!profile?.id) return;

        if (!confirm("Are you sure you want to permanently delete this item?")) return;

        try {
            const { error } = await supabase.from(table).delete().eq("id", id);
            if (error) throw error;

            toast.success("Item removed");
            loadAllData(profile.id);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Add / Edit Project Handler
    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        try {
            const payload = {
                user_id: profile.id,
                title: projectForm.title,
                description: projectForm.description,
                status: projectForm.status as any,
                progress: projectForm.progress,
                deadline: projectForm.deadline || null,
                priority: projectForm.priority as any
            };

            if (editingItem) {
                const { error } = await supabase.from("strategic_projects").update(payload).eq("id", editingItem.id);
                if (error) throw error;
                toast.success("Project updated");
            } else {
                const { error } = await supabase.from("strategic_projects").insert([payload]);
                if (error) throw error;
                toast.success("Strategic Project created!");
            }

            setModalType(null);
            setEditingItem(null);
            setProjectForm({ title: "", description: "", status: "Planning", progress: 0, deadline: "", priority: "Medium" });
            loadAllData(profile.id);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const updateProjectField = async (projectId: string, field: 'status' | 'progress', value: any) => {
        if (!profile?.id) return;

        // Optimistic UI update
        const updatedProjects = projects.map(proj => 
            proj.id === projectId ? { ...proj, [field]: value } : proj
        );
        setProjects(updatedProjects);

        try {
            const { error } = await supabase
                .from("strategic_projects")
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq("id", projectId);

            if (error) throw error;
        } catch (err: any) {
            toast.error(`Failed to update project ${field}`);
            loadAllData(profile.id);
        }
    };

    // Add / Edit Decision handler
    const handleSaveDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        try {
            const payload = {
                user_id: profile.id,
                title: decisionForm.title,
                reason: decisionForm.reason,
                expected_outcome: decisionForm.expected_outcome,
                actual_outcome: decisionForm.actual_outcome,
                decision_date: decisionForm.decision_date || new Date().toISOString().split("T")[0],
                review_date: decisionForm.review_date || null,
                status: decisionForm.status as any
            };

            if (editingItem) {
                const { error } = await supabase.from("decision_log").update(payload).eq("id", editingItem.id);
                if (error) throw error;
                toast.success("Decision updated");
            } else {
                const { error } = await supabase.from("decision_log").insert([payload]);
                if (error) throw error;
                toast.success("Decision logged in journal!");
            }

            setModalType(null);
            setEditingItem(null);
            setDecisionForm({ title: "", reason: "", expected_outcome: "", actual_outcome: "", decision_date: "", review_date: "", status: "Pending Review" });
            loadAllData(profile.id);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Add / Edit Vision handler
    const handleSaveVision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        try {
            const payload = {
                user_id: profile.id,
                title: visionForm.title,
                description: visionForm.description,
                image_url: visionForm.image_url || null,
                target_year: visionForm.target_year,
                display_order: visionForm.display_order
            };

            if (editingItem) {
                const { error } = await supabase.from("vision_board").update(payload).eq("id", editingItem.id);
                if (error) throw error;
                toast.success("Vision statement updated");
            } else {
                const { error } = await supabase.from("vision_board").insert([payload]);
                if (error) throw error;
                toast.success("Vision card added!");
            }

            setModalType(null);
            setEditingItem(null);
            setVisionForm({ title: "", description: "", image_url: "", target_year: new Date().getFullYear(), display_order: 0 });
            loadAllData(profile.id);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Add / Edit Resource handler
    const handleSaveResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        try {
            const payload = {
                user_id: profile.id,
                title: resourceForm.title,
                category: resourceForm.category as any,
                file_url: resourceForm.file_url || null,
                notes: resourceForm.notes || null
            };

            if (editingItem) {
                const { error } = await supabase.from("resources").update(payload).eq("id", editingItem.id);
                if (error) throw error;
                toast.success("Resource updated");
            } else {
                const { error } = await supabase.from("resources").insert([payload]);
                if (error) throw error;
                toast.success("Resource saved to library");
            }

            setModalType(null);
            setEditingItem(null);
            setResourceForm({ title: "", category: "Notes", file_url: "", notes: "" });
            loadAllData(profile.id);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Quick open Edit Modals
    const openEditModal = (type: any, item: any) => {
        setEditingItem(item);
        setModalType(type);
        if (type === "idea") {
            setIdeaForm({
                title: item.title,
                description: item.content || "",
                category: item.category,
                priority: item.priority,
                tags: item.tags?.join(", ") || ""
            });
        } else if (type === "project") {
            setProjectForm({
                title: item.title,
                description: item.description || "",
                status: item.status,
                progress: item.progress || 0,
                deadline: item.deadline || "",
                priority: item.priority
            });
        } else if (type === "decision") {
            setDecisionForm({
                title: item.title,
                reason: item.reason || "",
                expected_outcome: item.expected_outcome || "",
                actual_outcome: item.actual_outcome || "",
                decision_date: item.decision_date || "",
                review_date: item.review_date || "",
                status: item.status
            });
        } else if (type === "vision") {
            setVisionForm({
                title: item.title,
                description: item.description || "",
                image_url: item.image_url || "",
                target_year: item.target_year || new Date().getFullYear(),
                display_order: item.display_order || 0
            });
        } else if (type === "resource") {
            setResourceForm({
                title: item.title,
                category: item.category,
                file_url: item.file_url || "",
                notes: item.notes || ""
            });
        }
    };

    const getMonthName = (m: number) => {
        return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1];
    };

    // Calculate Completion Rates for Annual vision progress
    const annualCompletionRate = useMemo(() => {
        if (allYearPlans.length === 0) return 0;
        const total = allYearPlans.reduce((sum, p) => sum + (p.completion || 0), 0);
        return Math.round(total / 12);
    }, [allYearPlans]);

    // Search filter across collections
    const getSearchResults = () => {
        if (!globalSearch.trim()) return [];
        const q = globalSearch.toLowerCase();
        const results: { type: string; title: string; category?: string; link: TabType; item: any }[] = [];

        ideas.forEach(i => {
            if (i.title.toLowerCase().includes(q) || i.content?.toLowerCase().includes(q)) {
                results.push({ type: "Idea", title: i.title, category: i.category, link: "ideas", item: i });
            }
        });

        projects.forEach(p => {
            if (p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) {
                results.push({ type: "Project", title: p.title, category: p.priority, link: "projects", item: p });
            }
        });

        decisions.forEach(d => {
            if (d.title.toLowerCase().includes(q) || d.reason?.toLowerCase().includes(q)) {
                results.push({ type: "Decision", title: d.title, category: d.status, link: "focus-vision", item: d });
            }
        });

        visionCards.forEach(v => {
            if (v.title.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q)) {
                results.push({ type: "Vision", title: v.title, category: `${v.target_year}`, link: "focus-vision", item: v });
            }
        });

        resources.forEach(r => {
            if (r.title.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q)) {
                results.push({ type: "Resource", title: r.title, category: r.category, link: "resources", item: r });
            }
        });

        return results;
    };

    if (authLoading || (loadingData && ideas.length === 0)) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-[#E86123] animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Opening Strategy Office...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-700 flex relative overflow-x-hidden">
            {/* Sidebar navigation */}
            <CEOSidebar activeView="strategy-office" />

            {/* Dashboard Content */}
            <div className="flex-1 ml-0 md:ml-[80px] p-6 md:p-10 min-h-screen flex flex-col gap-8 max-w-7xl mx-auto w-full pb-20">
                
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-slate-200/80">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50/50 flex items-center justify-center border border-orange-100 p-2 shrink-0">
                            <Brain className="w-6 h-6 text-[#E86123]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[#E86123] mb-0.5 font-bold text-[10px] uppercase tracking-widest">
                                <Brain className="w-3.5 h-3.5" />
                                <span>Executive Workspace</span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight font-Outfit uppercase">Strategy Office</h1>
                            <p className="text-xs text-slate-500 mt-0.5">Private workspace for planning the future of Usthad Academy.</p>
                        </div>
                    </div>

                    {/* Actions and Search */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search everything..."
                                value={globalSearch}
                                onChange={(e) => setGlobalSearch(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs w-[180px] md:w-[220px] focus:outline-none focus:border-[#E86123] transition-all"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            
                            {/* Search overlay dropdown */}
                            {isSearchFocused && globalSearch && (
                                <div className="absolute right-0 mt-2 w-[320px] bg-white border border-slate-200 shadow-xl rounded-2xl p-2 z-50 max-h-[300px] overflow-y-auto">
                                    <div className="flex justify-between items-center px-3 py-1.5 border-b border-slate-100 mb-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Search Results ({getSearchResults().length})</span>
                                        <button onClick={() => { setGlobalSearch(""); setIsSearchFocused(false); }} className="text-slate-400 hover:text-slate-600">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {getSearchResults().length === 0 ? (
                                        <div className="text-[10px] text-slate-400 text-center py-4 uppercase">No matches found</div>
                                    ) : (
                                        getSearchResults().map((res, index) => (
                                            <div 
                                                key={index} 
                                                onClick={() => {
                                                    setActiveTab(res.link);
                                                    setIsSearchFocused(false);
                                                    setGlobalSearch("");
                                                    if (res.link === "ideas" || res.link === "projects") {
                                                        openEditModal(res.link.slice(0, -1), res.item);
                                                    }
                                                }}
                                                className="px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{res.title}</span>
                                                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{res.type}</span>
                                                </div>
                                                {res.category && (
                                                    <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{res.category}</p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => { setModalType("idea"); setEditingItem(null); }}
                            className="bg-[#E86123]/5 border border-[#E86123]/20 hover:bg-[#E86123]/10 text-[#E86123] text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" /> Idea
                        </button>
                        <button 
                            onClick={() => { setModalType("project"); setEditingItem(null); }}
                            className="bg-[#E86123]/5 border border-[#E86123]/20 hover:bg-[#E86123]/10 text-[#E86123] text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" /> Project
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-200/60 gap-1 overflow-x-auto pb-px scrollbar-none">
                    {[
                        { id: "focus-vision", label: "Vision Board", icon: Target },
                        { id: "ideas", label: "Ideas Board", icon: Brain },
                        { id: "plans", label: "Planner Suite", icon: Calendar },
                        { id: "projects", label: "Strategic Projects", icon: Layers },
                        { id: "journals", label: "Executive Journals", icon: FileText },
                        { id: "resources", label: "Resource Library", icon: Folder }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                                    isActive 
                                        ? "border-[#E86123] text-[#E86123] bg-[#E86123]/5 rounded-t-xl" 
                                        : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Sub-Views Content */}
                <div className="flex-1 flex flex-col gap-8 transition-all duration-300">
                    
                    {/* Theme-based Strategic Quote Banner */}
                    {TAB_QUOTES[activeTab] && (
                        <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-fadeIn">
                            <span className="text-xl text-[#E86123] font-serif font-black leading-none shrink-0">“</span>
                            <div className="flex-1">
                                <p className="text-xs italic text-slate-600 font-medium leading-relaxed">
                                    {TAB_QUOTES[activeTab].text}
                                </p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    — {TAB_QUOTES[activeTab].author}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* VIEW 1: VISION BOARD */}
                    {activeTab === "focus-vision" && (
                        <div className="flex flex-col gap-8 animate-fadeIn">
                            
                            {/* Premium Vision Board Header Banner */}
                            <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-200/50 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md border border-orange-100 p-2.5 shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/images/usthadacademylogo2.svg" alt="UA Logo" className="w-full h-full object-contain" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black uppercase text-slate-800 tracking-wider font-Outfit">
                                            Usthad Academy Vision
                                        </h2>
                                        <p className="text-xs text-slate-500 max-w-xl leading-relaxed mt-1">
                                            Establish the core values, long-term targets, and educational directives that shape the path ahead. Define target milestones to align team execution.
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setModalType("vision"); setEditingItem(null); }}
                                    className="bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-md shadow-orange-500/10 flex items-center gap-1.5 shrink-0"
                                >
                                    <Plus className="w-4 h-4" /> Add Vision Card
                                </button>
                            </div>

                            {/* Section 7: Vision Board Grid */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-5 h-5 text-[#E86123]" />
                                        <h2 className="text-base font-black uppercase text-slate-800 font-Outfit">Core Milestones & Directives</h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {visionCards.length === 0 ? (
                                        <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-8 col-span-3 text-center text-slate-400">
                                            No vision statements created. Define some long-term goals for Usthad Academy.
                                        </div>
                                    ) : (
                                        visionCards.map(vis => (
                                            <div 
                                                key={vis.id}
                                                className="relative bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[200px]"
                                            >
                                                {vis.image_url && (
                                                    <div className="absolute inset-0 z-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={vis.image_url} alt="" className="w-full h-full object-cover opacity-10 group-hover:scale-110 transition-transform duration-75" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-transparent" />
                                                    </div>
                                                )}
                                                <div className="relative z-10 flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-[9px] font-black px-2.5 py-1 bg-orange-50 text-[#E86123] rounded-lg uppercase tracking-wider border border-orange-100/50">Target Year: {vis.target_year || "N/A"}</span>
                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => openEditModal("vision", vis)} className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 p-1.5 rounded-lg shadow-sm">
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => handleDeleteItem("vision_board", vis.id)} className="text-slate-400 hover:text-red-500 bg-white border border-slate-200 p-1.5 rounded-lg shadow-sm">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide font-Outfit">{vis.title}</h3>
                                                        <p className="text-xs text-slate-500 mt-2 line-clamp-4 leading-relaxed font-medium">{vis.description}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: IDEAS BOARD (KANBAN) */}
                    {activeTab === "ideas" && (
                        <div className="flex flex-col gap-6 animate-fadeIn">
                            
                            {/* Section 2: Quick Capture Card */}
                            <div className="bg-gradient-to-r from-orange-500/10 via-orange-600/5 to-white border border-orange-500/20 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-orange-950 uppercase tracking-wide">Quick Idea Capture</h3>
                                    <p className="text-xs text-slate-600 mt-0.5">Instant sandbox for saving business ideas, growth vectors, or academic changes.</p>
                                </div>
                                <button
                                    onClick={() => { setModalType("idea"); setEditingItem(null); }}
                                    className="px-5 py-3 bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <PlusCircle className="w-4 h-4" /> Capture New Idea
                                </button>
                            </div>

                            {/* Section 3: Kanban Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                {["Inbox", "Planning", "Executing", "Completed", "Archived"].map((statusCol) => {
                                    const colIdeas = ideas.filter(i => i.status === statusCol);
                                    return (
                                        <div 
                                            key={statusCol}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDrop(e, statusCol as any)}
                                            className="bg-slate-50 border border-slate-200/60 rounded-3xl p-4 min-h-[400px] flex flex-col gap-4"
                                        >
                                            <div className="flex justify-between items-center px-1 border-b border-slate-200/50 pb-2">
                                                <span className="text-xs font-black uppercase text-slate-700 tracking-wider font-Outfit">{statusCol}</span>
                                                <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full font-bold text-slate-600">{colIdeas.length}</span>
                                            </div>

                                            <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1">
                                                {colIdeas.length === 0 ? (
                                                    <div className="text-[10px] text-slate-400 text-center py-8 uppercase tracking-widest border border-dashed border-slate-200 rounded-xl bg-white/20">Drop cards here</div>
                                                ) : (
                                                    colIdeas.map(idea => (
                                                        <div
                                                            key={idea.id}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, idea.id)}
                                                            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-[#E86123]/40 hover:shadow transition-all relative group"
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                                    idea.priority === "Critical" ? "bg-red-100 text-red-700" :
                                                                    idea.priority === "High" ? "bg-orange-100 text-orange-700" :
                                                                    idea.priority === "Medium" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                                                                }`}>
                                                                    {idea.priority}
                                                                </span>

                                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => openEditModal("idea", idea)} className="text-slate-400 hover:text-slate-600" title="Edit">
                                                                        <Edit3 className="w-3 h-3" />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteItem("ideas", idea.id)} className="text-slate-400 hover:text-red-500" title="Delete">
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide line-clamp-1">{idea.title}</h4>
                                                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{idea.content}</p>
                                                            
                                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                                                <span>{idea.category}</span>
                                                                <span>{new Date(idea.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* VIEW 3: PLANNER SUITE */}
                    {activeTab === "plans" && (
                        <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">
                            
                            {/* Left panel: Monthly planner (Section 4) */}
                            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 md:p-8 flex-1 flex flex-col gap-6">
                                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-[#E86123]" />
                                        <h3 className="text-lg font-black uppercase text-slate-800 font-Outfit">Monthly Planner</h3>
                                    </div>

                                    {/* Month Selector */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                const prevM = currentPlannerMonth === 1 ? 12 : currentPlannerMonth - 1;
                                                const prevY = currentPlannerMonth === 1 ? currentPlannerYear - 1 : currentPlannerYear;
                                                setCurrentPlannerMonth(prevM);
                                                setCurrentPlannerYear(prevY);
                                                fetchMonthlyPlan(profile?.id || "", prevM, prevY);
                                            }}
                                            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-black uppercase text-slate-700 tracking-wider min-w-[140px] text-center">
                                            {getMonthName(currentPlannerMonth)} {currentPlannerYear}
                                        </span>
                                        <button 
                                            onClick={() => {
                                                const nextM = currentPlannerMonth === 12 ? 1 : currentPlannerMonth + 1;
                                                const nextY = currentPlannerMonth === 12 ? currentPlannerYear + 1 : currentPlannerYear;
                                                setCurrentPlannerMonth(nextM);
                                                setCurrentPlannerYear(nextY);
                                                fetchMonthlyPlan(profile?.id || "", nextM, nextY);
                                            }}
                                            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {(() => {
                                    const now = new Date();
                                    const currentYear = now.getFullYear();
                                    const currentMonth = now.getMonth() + 1;
                                    const isFutureMonth = currentPlannerYear > currentYear || (currentPlannerYear === currentYear && currentPlannerMonth > currentMonth);

                                    if (isFutureMonth) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                                                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2 animate-pulse" />
                                                <h4 className="text-sm font-black uppercase text-slate-800 font-Outfit">Future Planner Locked</h4>
                                                <p className="text-xs text-slate-500 mt-1 max-w-[280px]">You can only plan months up to the current active month ({getMonthName(currentMonth)} {currentYear}).</p>
                                            </div>
                                        );
                                    }

                                    if (!monthlyPlan) {
                                        return <div className="text-xs text-slate-400 text-center py-10 uppercase">Loading Month Details...</div>;
                                    }

                                    const isLocked = monthlyPlan.is_locked || false;

                                    return (
                                        <div className="flex flex-col gap-6">
                                            {/* Locking toggle bar */}
                                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                                                <div className="flex items-center gap-2">
                                                    {isLocked ? (
                                                        <span className="flex items-center gap-1.5 text-xs font-black uppercase text-[#E86123]"><Lock className="w-3.5 h-3.5"/> Plan Locked</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-500"><Unlock className="w-3.5 h-3.5"/> Plan Open</span>
                                                    )}
                                                    <span className="text-[10px] text-slate-400">
                                                        {isLocked 
                                                            ? "Editable only for completion progress and audit comments." 
                                                            : "Fill out planning details below and lock to begin execution tracking."}
                                                    </span>
                                                </div>
                                                {isLocked ? (
                                                    <button
                                                        onClick={() => saveMonthlyPlanField("is_locked", false)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                                                    >
                                                        <Unlock className="w-3 h-3"/> Edit Plan
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => saveMonthlyPlanField("is_locked", true)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#E86123] hover:bg-[#d05018] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                                                    >
                                                        <Lock className="w-3 h-3"/> Lock Plan
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Objective */}
                                                <div className="flex flex-col gap-1.5 md:col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Main Objective</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-800">{monthlyPlan.objective || "No objective registered"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={2}
                                                            value={monthlyPlan.objective || ""}
                                                            onChange={(e) => saveMonthlyPlanField("objective", e.target.value)}
                                                            placeholder="Primary objective for the month..."
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Marketing */}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marketing Goals</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{monthlyPlan.marketing || "Not defined"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={3}
                                                            value={monthlyPlan.marketing || ""}
                                                            onChange={(e) => saveMonthlyPlanField("marketing", e.target.value)}
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Academics */}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Goals</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{monthlyPlan.academics || "Not defined"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={3}
                                                            value={monthlyPlan.academics || ""}
                                                            onChange={(e) => saveMonthlyPlanField("academics", e.target.value)}
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Operations */}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operational Goals</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{monthlyPlan.operations || "Not defined"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={3}
                                                            value={monthlyPlan.operations || ""}
                                                            onChange={(e) => saveMonthlyPlanField("operations", e.target.value)}
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Finance */}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Financial Goals</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{monthlyPlan.finance || "Not defined"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={3}
                                                            value={monthlyPlan.finance || ""}
                                                            onChange={(e) => saveMonthlyPlanField("finance", e.target.value)}
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Events */}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Important Events</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{monthlyPlan.events || "Not defined"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={2}
                                                            value={monthlyPlan.events || ""}
                                                            onChange={(e) => saveMonthlyPlanField("events", e.target.value)}
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Challenges */}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Challenges</label>
                                                    {isLocked ? (
                                                        <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{monthlyPlan.challenges || "Not defined"}</div>
                                                    ) : (
                                                        <textarea
                                                            rows={2}
                                                            value={monthlyPlan.challenges || ""}
                                                            onChange={(e) => saveMonthlyPlanField("challenges", e.target.value)}
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                        />
                                                    )}
                                                </div>

                                                {/* Completion slider (Visible ONLY when locked) */}
                                                {isLocked && (
                                                    <div className="flex flex-col gap-1.5 md:col-span-2 animate-fadeIn">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completion Target</label>
                                                            <span className="text-xs font-black text-[#E86123]">{monthlyPlan.completion}%</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="100"
                                                            value={monthlyPlan.completion || 0}
                                                            onChange={(e) => saveMonthlyPlanField("completion", parseInt(e.target.value))}
                                                            className="w-full accent-[#E86123]"
                                                        />
                                                    </div>
                                                )}

                                                {/* Performance Audit (Visible ONLY when locked) */}
                                                {isLocked && (
                                                    <div className="md:col-span-2 border-t border-slate-100 pt-6 flex flex-col gap-3 animate-fadeIn">
                                                        <div className="flex items-center gap-1.5 text-[#E86123]">
                                                            <Star className="w-4 h-4 fill-[#E86123]" />
                                                            <h4 className="text-xs font-black uppercase tracking-wider font-Outfit">Monthly Performance Audit</h4>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Achievements, Failures & Lessons</label>
                                                            <textarea
                                                                rows={3}
                                                                value={monthlyPlan.notes || ""}
                                                                onChange={(e) => saveMonthlyPlanField("notes", e.target.value)}
                                                                placeholder="Document wins, learnings, failures, and growth ideas discovered..."
                                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Right panel: Year Planner timeline (Section 5) */}
                            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 md:p-8 w-full lg:w-[360px] flex flex-col gap-6">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 font-Outfit">Year Planner</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Annual tracking dashboard.</p>
                                </div>

                                {/* Annual vision */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase text-[#E86123] tracking-wider">Annual Vision</span>
                                    <textarea
                                        rows={3}
                                        value={annualVision}
                                        onChange={(e) => setAnnualVision(e.target.value)}
                                        className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none py-1 resize-none"
                                    />
                                    <div className="border-t border-slate-200 pt-3 mt-1 flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Annual Completion Rate</span>
                                        <span className="text-xs font-black text-indigo-900">{annualCompletionRate}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-[#E86123] h-full" style={{ width: `${annualCompletionRate}%` }}></div>
                                    </div>
                                </div>

                                {/* 12 Months Navigation Timeline */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timeline Index</span>
                                    {Array.from({ length: 12 }, (_, index) => {
                                        const mIndex = index + 1;
                                        const mPlan = allYearPlans.find(p => p.month === mIndex);
                                        const isSelected = currentPlannerMonth === mIndex;
                                        return (
                                            <div 
                                                key={mIndex}
                                                onClick={() => {
                                                    setCurrentPlannerMonth(mIndex);
                                                    fetchMonthlyPlan(profile?.id || "", mIndex, currentPlannerYear);
                                                }}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isSelected 
                                                        ? "border-[#E86123] bg-[#E86123]/5" 
                                                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                <span className={`text-xs font-black uppercase ${isSelected ? "text-[#E86123]" : "text-slate-700"}`}>{getMonthName(mIndex)}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400">{mPlan?.completion || 0}%</span>
                                                    <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                                                        <div className="bg-[#E86123]/60 h-full" style={{ width: `${mPlan?.completion || 0}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW 4: STRATEGIC PROJECTS */}
                    {activeTab === "projects" && (
                        <div className="flex flex-col gap-6 animate-fadeIn">
                            
                            {/* Section 6: Projects Grid */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-[#E86123]" />
                                    <h2 className="text-lg font-black uppercase text-slate-800 font-Outfit">Strategic Initiatives</h2>
                                </div>
                                <button 
                                    onClick={() => { setModalType("project"); setEditingItem(null); }}
                                    className="bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Create New Project
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {projects.length === 0 ? (
                                    <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-8 col-span-3 text-center text-slate-400">
                                        No strategic projects logged. Click 'Create New Project' to map initiatives.
                                    </div>
                                ) : (
                                    projects.map(proj => (
                                        <div 
                                            key={proj.id}
                                            className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 hover:shadow-md transition-all flex flex-col justify-between group min-h-[220px]"
                                        >
                                            <div>
                                                <div className="flex justify-between items-center mb-3">
                                                    <select
                                                        value={proj.status}
                                                        onChange={(e) => updateProjectField(proj.id, 'status', e.target.value)}
                                                        className="text-[10px] font-black uppercase px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                                                    >
                                                        {['Planning', 'Research', 'Development', 'Testing', 'Completed'].map(st => (
                                                            <option key={st} value={st}>{st}</option>
                                                        ))}
                                                    </select>
                                                    
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditModal("project", proj)} className="text-slate-400 hover:text-slate-600">
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteItem("strategic_projects", proj.id)} className="text-slate-400 hover:text-red-500">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">{proj.title}</h3>
                                                <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">{proj.description}</p>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                                <div className="flex justify-between items-center text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase">Progress</span>
                                                    <span className="text-[#E86123]">{proj.progress}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={proj.progress || 0}
                                                    onChange={(e) => updateProjectField(proj.id, 'progress', parseInt(e.target.value))}
                                                    className="w-full accent-[#E86123]"
                                                />
                                                {proj.deadline && (
                                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-1 uppercase">
                                                        <span>Deadline</span>
                                                        <span>{new Date(proj.deadline).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW 5: EXECUTIVE JOURNALS */}
                    {activeTab === "journals" && (
                        <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">
                            
                            {/* Left Panel: Daily Business Journal (Section 9) */}
                            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 md:p-8 flex-1 flex flex-col gap-6">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-[#E86123]" />
                                        <h3 className="text-lg font-black uppercase text-slate-800 font-Outfit">Business Journal</h3>
                                    </div>

                                    {/* Date navigation */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                const d = new Date(journalDate);
                                                d.setDate(d.getDate() - 1);
                                                const dStr = d.toISOString().split("T")[0];
                                                setJournalDate(dStr);
                                                fetchJournalEntry(profile?.id || "", dStr);
                                            }}
                                            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <input
                                            type="date"
                                            value={journalDate}
                                            onChange={(e) => {
                                                setJournalDate(e.target.value);
                                                fetchJournalEntry(profile?.id || "", e.target.value);
                                            }}
                                            className="bg-transparent text-xs font-black uppercase text-slate-700 focus:outline-none"
                                        />
                                        <button 
                                            onClick={() => {
                                                const d = new Date(journalDate);
                                                d.setDate(d.getDate() + 1);
                                                const dStr = d.toISOString().split("T")[0];
                                                setJournalDate(dStr);
                                                fetchJournalEntry(profile?.id || "", dStr);
                                            }}
                                            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {journalEntry && (
                                    <div className="flex flex-col gap-5">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Wins</label>
                                            <textarea
                                                id="journal-wins-input"
                                                rows={3}
                                                value={journalEntry.wins || ""}
                                                onChange={(e) => saveJournalField("wins", e.target.value)}
                                                placeholder="List critical victories, team wins, or major milestones achieved..."
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Problems & Risks</label>
                                            <textarea
                                                rows={3}
                                                value={journalEntry.problems || ""}
                                                onChange={(e) => saveJournalField("problems", e.target.value)}
                                                placeholder="Document unexpected leaks, system alerts, or operational friction..."
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ideas Discovered</label>
                                            <textarea
                                                rows={2}
                                                value={journalEntry.ideas || ""}
                                                onChange={(e) => saveJournalField("ideas", e.target.value)}
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lessons Learned</label>
                                            <textarea
                                                rows={2}
                                                value={journalEntry.lessons || ""}
                                                onChange={(e) => saveJournalField("lessons", e.target.value)}
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tomorrow's Focus</label>
                                            <textarea
                                                rows={2}
                                                value={journalEntry.tomorrow_focus || ""}
                                                onChange={(e) => saveJournalField("tomorrow_focus", e.target.value)}
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Panel: Decision Log Journal (Section 8) */}
                            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 md:p-8 w-full lg:w-[440px] flex flex-col gap-6">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-[#E86123]" />
                                        <h3 className="text-lg font-black uppercase text-slate-800 font-Outfit">Decision Journal</h3>
                                    </div>
                                    <button 
                                        onClick={() => { setModalType("decision"); setEditingItem(null); }}
                                        className="text-xs font-bold text-[#E86123] hover:underline flex items-center gap-0.5"
                                    >
                                        <Plus className="w-3 h-3" /> Log Decision
                                    </button>
                                </div>

                                <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-1">
                                    {decisions.length === 0 ? (
                                        <div className="text-[10px] text-slate-400 text-center py-10 uppercase">No decisions recorded in journal yet.</div>
                                    ) : (
                                        decisions.map(dec => (
                                            <div 
                                                key={dec.id}
                                                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col gap-2 group relative"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(dec.decision_date).toLocaleDateString()}</span>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                        dec.status === "Successful" ? "bg-emerald-100 text-emerald-700" :
                                                        dec.status === "Needs Improvement" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"
                                                    }`}>{dec.status}</span>
                                                </div>

                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide pr-10">{dec.title}</h4>
                                                
                                                {dec.reason && (
                                                    <p className="text-[10px] text-slate-500 leading-relaxed"><strong className="text-slate-600">Reason:</strong> {dec.reason}</p>
                                                )}
                                                {dec.expected_outcome && (
                                                    <p className="text-[10px] text-slate-500 leading-relaxed"><strong className="text-slate-600">Outcome:</strong> {dec.expected_outcome}</p>
                                                )}

                                                <div className="absolute right-3 top-9 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEditModal("decision", dec)} className="text-slate-400 hover:text-slate-600">
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteItem("decision_log", dec.id)} className="text-slate-400 hover:text-red-500">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW 6: RESOURCE LIBRARY */}
                    {activeTab === "resources" && (
                        <div className="flex flex-col gap-6 animate-fadeIn">
                            
                            {/* Section 10: Resource Library */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Folder className="w-5 h-5 text-[#E86123]" />
                                    <h2 className="text-lg font-black uppercase text-slate-800 font-Outfit">Resource Library</h2>
                                </div>
                                <button 
                                    onClick={() => { setModalType("resource"); setEditingItem(null); }}
                                    className="bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Store Resource
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {resources.length === 0 ? (
                                    <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-8 col-span-4 text-center text-slate-400">
                                        No useful documents, link bookmarks, or templates uploaded to strategy library.
                                    </div>
                                ) : (
                                    resources.map(res => (
                                        <div 
                                            key={res.id}
                                            className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-5 hover:shadow-md transition-all flex flex-col justify-between group min-h-[140px]"
                                        >
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-500 rounded">{res.category}</span>
                                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditModal("resource", res)} className="text-slate-400 hover:text-slate-600">
                                                            <Edit3 className="w-3 h-3" />
                                                        </button>
                                                        <button onClick={() => handleDeleteItem("resources", res.id)} className="text-slate-400 hover:text-red-500">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide line-clamp-1">{res.title}</h3>
                                                {res.notes && (
                                                    <p className="text-[10px] text-slate-400 mt-2 line-clamp-2">{res.notes}</p>
                                                )}
                                            </div>
                                            {res.file_url && (
                                                <a 
                                                    href={res.file_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="mt-3 text-[10px] font-bold text-[#E86123] hover:underline flex items-center gap-1 uppercase"
                                                >
                                                    <Link2 className="w-3 h-3" /> Visit Asset Link
                                                </a>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* MODALS GATE CONTROLLER */}

            {/* Modal 1: Capture Idea */}
            {modalType === "idea" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-4">
                        <button onClick={() => setModalType(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                        <h3 className="text-base font-black uppercase text-slate-800 tracking-wider font-Outfit">
                            {editingItem ? "Edit Captured Idea" : "Capture New Idea"}
                        </h3>

                        <form onSubmit={handleSaveIdea} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={ideaForm.title}
                                    onChange={(e) => setIdeaForm({ ...ideaForm, title: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                                <textarea
                                    rows={3}
                                    value={ideaForm.description}
                                    onChange={(e) => setIdeaForm({ ...ideaForm, description: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Category</label>
                                    <select
                                        value={ideaForm.category}
                                        onChange={(e) => setIdeaForm({ ...ideaForm, category: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    >
                                        {['Marketing', 'Courses', 'Operations', 'Finance', 'Technology', 'Staff', 'Students', 'General'].map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Priority</label>
                                    <select
                                        value={ideaForm.priority}
                                        onChange={(e) => setIdeaForm({ ...ideaForm, priority: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    >
                                        {['Low', 'Medium', 'High', 'Critical'].map(pri => (
                                            <option key={pri} value={pri}>{pri}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Tags (comma-separated)</label>
                                <input
                                    type="text"
                                    value={ideaForm.tags}
                                    placeholder="Growth, Automation, Premium"
                                    onChange={(e) => setIdeaForm({ ...ideaForm, tags: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-3 bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all mt-2"
                            >
                                Save Idea
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Strategic Project */}
            {modalType === "project" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-4">
                        <button onClick={() => setModalType(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                        <h3 className="text-base font-black uppercase text-slate-800 tracking-wider font-Outfit">
                            {editingItem ? "Edit Project Details" : "Map Strategic Project"}
                        </h3>

                        <form onSubmit={handleSaveProject} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Project Title</label>
                                <input
                                    type="text"
                                    required
                                    value={projectForm.title}
                                    onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                                <textarea
                                    rows={3}
                                    value={projectForm.description}
                                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Priority</label>
                                    <select
                                        value={projectForm.priority}
                                        onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    >
                                        {['Low', 'Medium', 'High', 'Critical'].map(pri => (
                                            <option key={pri} value={pri}>{pri}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Deadline</label>
                                    <input
                                        type="date"
                                        value={projectForm.deadline}
                                        onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-3 bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all mt-2"
                            >
                                Save Project
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 3: Decision Log */}
            {modalType === "decision" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-4">
                        <button onClick={() => setModalType(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                        <h3 className="text-base font-black uppercase text-slate-800 tracking-wider font-Outfit">
                            {editingItem ? "Edit Decision Entry" : "Journal Decision Log"}
                        </h3>

                        <form onSubmit={handleSaveDecision} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Decision Title</label>
                                <input
                                    type="text"
                                    required
                                    value={decisionForm.title}
                                    onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Reason / Justification</label>
                                <textarea
                                    rows={2}
                                    value={decisionForm.reason}
                                    onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Expected Outcome</label>
                                <textarea
                                    rows={2}
                                    value={decisionForm.expected_outcome}
                                    onChange={(e) => setDecisionForm({ ...decisionForm, expected_outcome: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                />
                            </div>

                            {editingItem && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Actual Outcome</label>
                                    <textarea
                                        rows={2}
                                        value={decisionForm.actual_outcome}
                                        onChange={(e) => setDecisionForm({ ...decisionForm, actual_outcome: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Decision Date</label>
                                    <input
                                        type="date"
                                        value={decisionForm.decision_date}
                                        onChange={(e) => setDecisionForm({ ...decisionForm, decision_date: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Review Date</label>
                                    <input
                                        type="date"
                                        value={decisionForm.review_date}
                                        onChange={(e) => setDecisionForm({ ...decisionForm, review_date: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Status</label>
                                <select
                                    value={decisionForm.status}
                                    onChange={(e) => setDecisionForm({ ...decisionForm, status: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                >
                                    {['Pending Review', 'Successful', 'Needs Improvement'].map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-3 bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all mt-2"
                            >
                                Save Decision Log
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 4: Vision Statement */}
            {modalType === "vision" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-4">
                        <button onClick={() => setModalType(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                        <h3 className="text-base font-black uppercase text-slate-800 tracking-wider font-Outfit">
                            {editingItem ? "Edit Vision Statement" : "Add Vision Statement"}
                        </h3>

                        <form onSubmit={handleSaveVision} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Vision Goal / Title</label>
                                <input
                                    type="text"
                                    required
                                    value={visionForm.title}
                                    onChange={(e) => setVisionForm({ ...visionForm, title: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Long-Term Impact Description</label>
                                <textarea
                                    rows={3}
                                    value={visionForm.description}
                                    onChange={(e) => setVisionForm({ ...visionForm, description: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Target Accomplish Year</label>
                                    <input
                                        type="number"
                                        required
                                        value={visionForm.target_year}
                                        onChange={(e) => setVisionForm({ ...visionForm, target_year: parseInt(e.target.value) || new Date().getFullYear() })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Display Order Index</label>
                                    <input
                                        type="number"
                                        value={visionForm.display_order}
                                        onChange={(e) => setVisionForm({ ...visionForm, display_order: parseInt(e.target.value) || 0 })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-3 bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all mt-2"
                            >
                                Save Vision
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 5: Resource Upload */}
            {modalType === "resource" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative flex flex-col gap-4">
                        <button onClick={() => setModalType(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                        <h3 className="text-base font-black uppercase text-slate-800 tracking-wider font-Outfit">
                            {editingItem ? "Edit Resource details" : "Register Useful Resource"}
                        </h3>

                        <form onSubmit={handleSaveResource} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Resource Title</label>
                                <input
                                    type="text"
                                    required
                                    value={resourceForm.title}
                                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Resource Type Category</label>
                                <select
                                    value={resourceForm.category}
                                    onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value as any })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                >
                                    {['Documents', 'Images', 'PDFs', 'Useful Links', 'Notes'].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Asset URL (Bookmarks / Links)</label>
                                <input
                                    type="url"
                                    value={resourceForm.file_url}
                                    placeholder="https://example.com/drive/folder"
                                    onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Description / Notes</label>
                                <textarea
                                    rows={3}
                                    value={resourceForm.notes}
                                    onChange={(e) => setResourceForm({ ...resourceForm, notes: e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#E86123] transition-all resize-none"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full py-3 bg-[#E86123] hover:bg-[#d05018] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all mt-2"
                            >
                                Save Resource
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
