"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users,
    Calendar,
    FileText,
    TrendingUp,
    Settings,
    BarChart3,
    Target,
    Clock,
    CheckCircle2,
    AlertTriangle,
    ChevronRight,
    Plus,
    Search,
    Filter,
    Download,
    RefreshCw,
    Eye,
    Edit,
    Trash2,
    Mail,
    Phone,
    MapPin,
    Award,
    Star,
    Briefcase,
    GraduationCap,
    ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useStaffPerformanceSummary } from "@/hooks/use-dashboard-data";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

// Brand colors
const BRAND = {
    navy: "#2F1E73",
    orange: "#FA4615",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
};

// Mock data for demonstration
const mockStaffData = [
    {
        id: "1",
        name: "John Smith",
        role: "Sales",
        department: "Sales",
        email: "john@ua.academy",
        phone: "+1234567890",
        status: "active",
        performance: 92,
        joinDate: "2024-01-15",
        lastActive: "2 hours ago",
    },
    {
        id: "2", 
        name: "Sarah Johnson",
        role: "Tutor",
        department: "Education",
        email: "sarah@ua.academy",
        phone: "+1234567891",
        status: "active",
        performance: 88,
        joinDate: "2024-02-20",
        lastActive: "1 hour ago",
    },
    {
        id: "3",
        name: "Mike Davis",
        role: "Staff",
        department: "Operations",
        email: "mike@ua.academy",
        phone: "+1234567892",
        status: "on_break",
        performance: 76,
        joinDate: "2023-11-10",
        lastActive: "30 minutes ago",
    },
];

const mockTasksData = [
    {
        id: "1",
        title: "Review Q2 Performance Reports",
        assignedTo: "John Smith",
        priority: "high",
        status: "in_progress",
        dueDate: "2024-05-03",
        category: "Management",
    },
    {
        id: "2",
        title: "Staff Training Session",
        assignedTo: "Sarah Johnson",
        priority: "medium",
        status: "pending",
        dueDate: "2024-05-05",
        category: "Training",
    },
    {
        id: "3",
        title: "Update Department Guidelines",
        assignedTo: "Mike Davis",
        priority: "low",
        status: "completed",
        dueDate: "2024-05-01",
        category: "Operations",
    },
];


interface ManagerOperationsCommandProps {
    className?: string;
}

export function ManagerOperationsCommand({ className }: ManagerOperationsCommandProps) {
    const { profile, user } = useAuth();
    const { data: performanceSummary = [], isLoading: isPerformanceLoading } = useStaffPerformanceSummary();

    const [activeTab, setActiveTab] = useState("overview");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStaff, setSelectedStaff] = useState<any>(null);

    const staffData = React.useMemo(() => {
        if (isPerformanceLoading || !performanceSummary || performanceSummary.length === 0) {
            return mockStaffData;
        }
        return performanceSummary.map((item: any) => ({
            id: item.id,
            name: item.full_name,
            role: item.designation || item.role || "Staff",
            department: item.role === "sales" ? "Sales" : item.role === "tutor" ? "Education" : "Operations",
            email: item.username ? `${item.username.toLowerCase()}@ua.academy` : "",
            phone: "+1234567890",
            status: "active",
            performance: item.completion_rate !== null && item.completion_rate !== undefined ? Math.round(item.completion_rate) : 0,
            joinDate: "2024-01-15",
            lastActive: "Online",
        }));
    }, [performanceSummary, isPerformanceLoading]);

    const [tasksData, setTasksData] = useState(mockTasksData);
    const [conversionsData, setConversionsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [selectedConversion, setSelectedConversion] = useState<any>(null);
    const [tutorName, setTutorName] = useState("");
    const [isAssigning, setIsAssigning] = useState(false);
    const [stats, setStats] = useState({
        totalStaff: 0,
        activeStaff: 0,
        onBreakStaff: 0,
        avgPerformance: 0,
        pendingTasks: 0,
        completedTasks: 0,
    });

    useEffect(() => {
        calculateStats();
        fetchConversions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staffData, tasksData]);

    const fetchConversions = async () => {
        try {
            console.log("Fetching conversions for administrator...");
            const { data, error } = await supabase
                .from("conversions")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching conversions:", error);
                toast.error(`Failed to load conversions: ${error.message}`);
                return;
            }

            // Sort data: unassigned entries first, then assigned entries
            const sortedData = data ? [...data].sort((a, b) => {
                // If a is unassigned and b is assigned, a comes first
                if (!a.assigned_tutor && b.assigned_tutor) return -1;
                // If a is assigned and b is unassigned, b comes first
                if (a.assigned_tutor && !b.assigned_tutor) return 1;
                // If both have same assignment status, maintain original order by created_at
                return 0;
            }) : [];

            console.log("Conversions data fetched and sorted:", sortedData);
            setConversionsData(sortedData);
            
            if (data && data.length > 0) {
                toast.success(`Loaded ${data.length} conversions`);
            } else {
                toast.info("No conversions found");
            }
        } catch (error) {
            console.error("Error fetching conversions:", error);
            toast.error("Failed to load conversions");
        }
    };

    const handleAssign = async () => {
        if (!tutorName.trim()) {
            toast.error("Please enter the tutor's name");
            return;
        }

        if (!selectedConversion) {
            toast.error("No conversion selected");
            return;
        }

        setIsAssigning(true);

        try {
            // Update conversion in database
            const updateData: any = {
                assigned_tutor: tutorName.trim(),
                assigned_at: new Date().toISOString(),
                status: "assigned",
            };

            const { error } = await supabase
                .from("conversions")
                .update(updateData)
                .eq("id", selectedConversion.id);

            if (error) {
                console.error("Error assigning tutor:", error);
                toast.error(`Failed to assign tutor: ${error.message}`);
                return;
            }

            // Refresh conversions data
            await fetchConversions();

            // Add to victory feed (mock - in real app this would update CEO dashboard)
            toast.success(`Student ${selectedConversion.student_name} assigned to ${tutorName.trim()}`, {
                description: "Updated in CEO Victory Feed",
            });

            // Reset dialog
            setTutorName("");
            setSelectedConversion(null);
            setIsAssignDialogOpen(false);
        } catch (error) {
            console.error("Error assigning tutor:", error);
            toast.error("Failed to assign tutor");
        } finally {
            setIsAssigning(false);
        }
    };

    const openAssignDialog = (conversion: any) => {
        setSelectedConversion(conversion);
        setIsAssignDialogOpen(true);
    };

    const calculateStats = () => {
        const totalStaff = staffData.length;
        const activeStaff = staffData.filter(s => s.status === "active").length;
        const onBreakStaff = staffData.filter(s => s.status === "on_break").length;
        const avgPerformance = Math.round(staffData.reduce((acc, s) => acc + s.performance, 0) / totalStaff);
        const pendingTasks = tasksData.filter(t => t.status === "pending").length;
        const completedTasks = tasksData.filter(t => t.status === "completed").length;

        setStats({
            totalStaff,
            activeStaff,
            onBreakStaff,
            avgPerformance,
            pendingTasks,
            completedTasks,
        });
    };

    const filteredStaff = staffData.filter(staff =>
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleIcon = (role: string) => {
        switch (role.toLowerCase()) {
            case "sales": return <TrendingUp className="w-4 h-4" />;
            case "tutor": return <GraduationCap className="w-4 h-4" />;
            case "staff": return <ShieldCheck className="w-4 h-4" />;
            default: return <Briefcase className="w-4 h-4" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "active": return "bg-green-100 text-green-800 border-green-200";
            case "on_break": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "offline": return "bg-gray-100 text-gray-800 border-gray-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high": return "bg-red-100 text-red-800 border-red-200";
            case "medium": return "bg-blue-100 text-blue-800 border-blue-200";
            case "low": return "bg-gray-100 text-gray-800 border-gray-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    return (
        <div className={`min-h-screen ${className}`} style={{ backgroundColor: BRAND.bg }}>
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Administrator Operations</h1>
                        <p className="text-slate-600 mt-1">Team management and oversight dashboard</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="flex items-center gap-2"
                            onClick={() => setLoading(!loading)}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            className="flex items-center gap-2"
                            style={{ backgroundColor: BRAND.navy }}
                        >
                            <Plus className="w-4 h-4" />
                            Add Task
                        </Button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-slate-200 px-8">
                <div className="flex gap-8">
                    {[
                        { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
                        { id: "staff", label: "Staff Management", icon: <Users className="w-4 h-4" /> },
                        { id: "sales", label: "Sales Operations", icon: <Target className="w-4 h-4" /> },
                        { id: "tasks", label: "Tasks", icon: <CheckCircle2 className="w-4 h-4" /> },
                        { id: "performance", label: "Performance", icon: <TrendingUp className="w-4 h-4" /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            {tab.icon}
                            <span className="font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-8">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600">Total Staff</p>
                                        <p className="text-2xl font-bold text-slate-900">{stats.totalStaff}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <Users className="w-6 h-6 text-blue-600" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600">Active Now</p>
                                        <p className="text-2xl font-bold text-green-600">{stats.activeStaff}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600">Avg Performance</p>
                                        <p className="text-2xl font-bold text-slate-900">{stats.avgPerformance}%</p>
                                    </div>
                                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-orange-600" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
                            <div className="space-y-3">
                                {tasksData.slice(0, 3).map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${
                                                task.status === "completed" ? "bg-green-500" :
                                                task.status === "in_progress" ? "bg-blue-500" : "bg-gray-400"
                                            }`} />
                                            <div>
                                                <p className="font-medium text-slate-900">{task.title}</p>
                                                <p className="text-sm text-slate-600">{task.assignedTo}</p>
                                            </div>
                                        </div>
                                        <Badge className={getPriorityColor(task.priority)}>
                                            {task.priority}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Staff Management Tab */}
                {activeTab === "staff" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Search and Filter */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    placeholder="Search staff by name, role, or department..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button variant="outline" className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filter
                            </Button>
                        </div>

                        {/* Staff Table */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-4 font-medium text-slate-700">Staff Member</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Role</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Department</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Status</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Performance</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Last Active</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStaff.map((staff) => (
                                            <tr key={staff.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                                            <span className="text-sm font-medium text-slate-600">
                                                                {staff.name.split(" ").map(n => n[0]).join("")}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">{staff.name}</p>
                                                            <p className="text-sm text-slate-600">{staff.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {getRoleIcon(staff.role)}
                                                        <span className="text-slate-900">{staff.role}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-900">{staff.department}</td>
                                                <td className="p-4">
                                                    <Badge className={getStatusColor(staff.status)}>
                                                        {staff.status.replace("_", " ")}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                                                            <div
                                                                className="bg-green-500 h-2 rounded-full"
                                                                style={{ width: `${staff.performance}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-900">{staff.performance}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-600">{staff.lastActive}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="sm">
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm">
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Sales Operations Tab */}
                {activeTab === "sales" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Sales Operations</h3>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                                    {conversionsData.filter(c => !c.assigned_tutor).length} Pending Assignment
                                </Badge>
                                <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                                    {conversionsData.filter(c => c.assigned_tutor).length} Assigned
                                </Badge>
                            </div>
                        </div>

                        {/* Conversions Table */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-200">
                                <h4 className="font-semibold text-slate-900">Student Conversions</h4>
                                <p className="text-sm text-slate-600 mt-1">Manage tutor assignments for converted students</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left p-4 font-medium text-slate-700">Student Name</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Sales Staff</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Conversion Date</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Assigned Tutor</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Status</th>
                                            <th className="text-left p-4 font-medium text-slate-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {conversionsData.map((conversion) => (
                                            <tr key={conversion.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                                            <span className="text-sm font-medium text-orange-800">
                                                                {conversion.student_name?.split(" ").map((n: string) => n[0]).join("") || "S"}
                                                            </span>
                                                        </div>
                                                        <span className="font-medium text-slate-900">{conversion.student_name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-900">{conversion.staff_name}</td>
                                                <td className="p-4 text-slate-600">{conversion.conversion_date}</td>
                                                <td className="p-4">
                                                    {conversion.assigned_tutor ? (
                                                        <Badge className="bg-green-100 text-green-800 border-green-200">
                                                            {conversion.assigned_tutor}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400">Not assigned</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <Badge className={
                                                        conversion.status === "assigned" 
                                                            ? "bg-green-100 text-green-800 border-green-200"
                                                            : "bg-yellow-100 text-yellow-800 border-yellow-200"
                                                    }>
                                                        {conversion.status === "assigned" ? "Assigned" : "Pending Assignment"}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    {!conversion.assigned_tutor && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => openAssignDialog(conversion)}
                                                            className="flex items-center gap-2"
                                                            style={{ backgroundColor: BRAND.orange }}
                                                        >
                                                            <Users className="w-4 h-4" />
                                                            Assign
                                                        </Button>
                                                    )}
                                                    {conversion.assigned_tutor && (
                                                        <Button variant="outline" size="sm" disabled>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            Assigned
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Tasks Tab */}
                {activeTab === "tasks" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Task Management</h3>
                            <Button className="flex items-center gap-2" style={{ backgroundColor: BRAND.navy }}>
                                <Plus className="w-4 h-4" />
                                Create Task
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tasksData.map((task) => (
                                <div key={task.id} className="bg-white rounded-xl p-6 border border-slate-200">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h4 className="font-semibold text-slate-900">{task.title}</h4>
                                            <p className="text-sm text-slate-600 mt-1">Assigned to: {task.assignedTo}</p>
                                        </div>
                                        <Badge className={getPriorityColor(task.priority)}>
                                            {task.priority}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Due: {task.dueDate}</span>
                                        <Badge variant="outline">{task.category}</Badge>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                            task.status === "completed" ? "bg-green-500" :
                                            task.status === "in_progress" ? "bg-blue-500" : "bg-gray-400"
                                        }`} />
                                        <span className="text-sm text-slate-600">{task.status.replace("_", " ")}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Performance Tab */}
                {activeTab === "performance" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <h3 className="text-lg font-semibold text-slate-900">Performance Analytics</h3>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-4">Team Performance Overview</h4>
                                <div className="space-y-4">
                                    {staffData.map((staff) => (
                                        <div key={staff.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                                    <span className="text-sm font-medium text-slate-600">
                                                        {staff.name.split(" ").map(n => n[0]).join("")}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{staff.name}</p>
                                                    <p className="text-sm text-slate-600">{staff.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 bg-slate-200 rounded-full h-2">
                                                    <div
                                                        className="bg-green-500 h-2 rounded-full"
                                                        style={{ width: `${staff.performance}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-slate-900">{staff.performance}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-4">Department Performance</h4>
                                <div className="space-y-4">
                                    {["Sales", "Education", "Operations"].map((dept) => (
                                        <div key={dept} className="flex items-center justify-between">
                                            <span className="font-medium text-slate-900">{dept}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 bg-slate-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full"
                                                        style={{ width: `${Math.random() * 30 + 70}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-slate-900">
                                                    {Math.round(Math.random() * 30 + 70)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

            {/* Assignment Dialog */}
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2" style={{ color: BRAND.navy }}>
                            <Users className="w-5 h-5" />
                            Assign Tutor to Student
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedConversion && (
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <p className="text-sm font-medium text-slate-700">Student Name</p>
                                <p className="text-lg font-semibold text-slate-900">{selectedConversion.student_name}</p>
                                <p className="text-sm text-slate-600 mt-1">Converted by: {selectedConversion.staff_name}</p>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="tutor-name" className="text-sm font-medium text-slate-700">
                                Tutor Name
                            </Label>
                            <Input
                                id="tutor-name"
                                type="text"
                                placeholder="Enter tutor's full name..."
                                value={tutorName}
                                onChange={(e) => setTutorName(e.target.value)}
                                className="mt-1 h-12 bg-slate-50 border-slate-200 focus:border-[#2F1E73] focus:ring-[#2F1E73]/20 rounded-xl"
                                style={{ color: "#1e293b" }}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsAssignDialogOpen(false);
                                    setTutorName("");
                                    setSelectedConversion(null);
                                }}
                                className="flex-1 h-12 rounded-xl font-medium"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAssign}
                                disabled={isAssigning || !tutorName.trim()}
                                className="flex-1 h-12 rounded-xl font-medium transition-all duration-200 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: BRAND.orange,
                                    color: "white",
                                }}
                            >
                                {isAssigning ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Users className="w-4 h-4 mr-2" />
                                )}
                                {isAssigning ? "Assigning..." : "Assign Tutor"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            </div>
        </div>
    );
}

export default ManagerOperationsCommand;
