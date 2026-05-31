"use client";

import React, { useState, useEffect } from "react";
import { Target, X, Save, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Brand colors
const BRAND = {
    navy: "#2F1E73",
    orange: "#FA4615",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
};

interface SetMonthlyTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: 'sales' | 'accounts';
    onSuccess?: () => void;
}

export function SetMonthlyTargetModal({ 
    isOpen, 
    onClose, 
    department,
    onSuccess 
}: SetMonthlyTargetModalProps) {
    const { profile } = useAuth();
    const [targetValue, setTargetValue] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTarget, setCurrentTarget] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load current target for this month
    useEffect(() => {
        if (isOpen && profile) {
            loadCurrentTarget();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, profile, department]);

    const loadCurrentTarget = async () => {
        if (!profile) return;

        setIsLoading(true);
        try {
            const currentMonth = new Date();
            currentMonth.setDate(1); // First day of current month
            
            const { data, error } = await supabase
                .from('monthly_targets')
                .select('*')
                .eq('profile_id', profile.id)
                .eq('department', department)
                .eq('target_month', currentMonth.toISOString().split('T')[0])
                .single();

            if (data && !error) {
                setCurrentTarget(data);
                setTargetValue(data.target_value.toString());
            } else {
                setCurrentTarget(null);
                setTargetValue("");
            }
        } catch (error) {
            console.error('Error loading current target:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!targetValue || parseFloat(targetValue) <= 0) {
            toast.error("Please enter a valid target value");
            return;
        }

        if (!profile) {
            toast.error("User not authenticated");
            return;
        }

        setIsSubmitting(true);

        try {
            const currentMonth = new Date();
            currentMonth.setDate(1); // First day of current month
            
            const targetData = {
                profile_id: profile.id,
                target_month: currentMonth.toISOString().split('T')[0],
                target_value: parseFloat(targetValue),
                department: department,
                updated_at: new Date().toISOString(),
            };

            if (currentTarget) {
                // Update existing target
                const { error } = await supabase
                    .from('monthly_targets')
                    .update(targetData)
                    .eq('id', currentTarget.id);

                if (error) {
                    console.error('Error updating target:', error);
                    console.error('Error details:', JSON.stringify(error, null, 2));
                    toast.error(`Failed to update monthly target: ${error.message || 'Unknown error'}`);
                    return;
                }

                toast.success("Monthly target updated successfully!");
            } else {
                // Create new target
                const { error } = await supabase
                    .from('monthly_targets')
                    .insert({
                        ...targetData,
                        current_progress: 0,
                        achievement_percentage: 0,
                    });

                if (error) {
                    console.error('Error creating target:', error);
                    console.error('Error details:', JSON.stringify(error, null, 2));
                    console.error('Target data being inserted:', JSON.stringify(targetData, null, 2));
                    toast.error(`Failed to set monthly target: ${error.message || 'Unknown error'}`);
                    return;
                }

                toast.success("Monthly target set successfully!");
            }

            onSuccess?.();
            onClose();
            setTargetValue("");
        } catch (error) {
            console.error('Error saving monthly target:', error);
            toast.error("An error occurred while saving the target");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTargetLabel = () => {
        return department === 'sales' 
            ? "Monthly Conversions Target" 
            : "Monthly Revenue Target (₹)";
    };

    const getPlaceholder = () => {
        return department === 'sales' 
            ? "e.g., 25 conversions" 
            : "e.g., 75000";
    };

    const getHelperText = () => {
        return department === 'sales' 
            ? "Set your target number of conversions for this month" 
            : "Set your target revenue amount for this month";
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: BRAND.softOrange }}
                        >
                            <Target className="w-5 h-5" style={{ color: BRAND.orange }} />
                        </div>
                        <div>
                            <div className="text-lg font-bold" style={{ color: BRAND.navy }}>
                                {currentTarget ? 'Update' : 'Set'} Monthly Target
                            </div>
                            <div className="text-sm text-gray-500 capitalize">
                                {department} Department
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Current Status */}
                    {currentTarget && (
                        <div className="p-4 rounded-xl border" style={{ 
                            backgroundColor: BRAND.softOrange,
                            borderColor: BRAND.orange + '30'
                        }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-600">
                                        Current Progress
                                    </div>
                                    <div className="text-lg font-bold" style={{ color: BRAND.navy }}>
                                        {currentTarget.current_progress} / {currentTarget.target_value}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold" style={{ color: BRAND.orange }}>
                                        {currentTarget.achievement_percentage.toFixed(1)}%
                                    </div>
                                    <div className="text-xs text-gray-500">achieved</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Target Input */}
                    <div className="space-y-2">
                        <Label htmlFor="target-value" className="text-sm font-medium">
                            {getTargetLabel()}
                        </Label>
                        <Input
                            id="target-value"
                            type="number"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                            placeholder={getPlaceholder()}
                            className="h-12 text-lg font-semibold"
                            disabled={isLoading || isSubmitting}
                        />
                        <p className="text-xs text-gray-500">
                            {getHelperText()}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || isLoading || !targetValue}
                            className="flex-1"
                            style={{ 
                                backgroundColor: BRAND.navy,
                                color: 'white'
                            }}
                        >
                            {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {currentTarget ? 'Update' : 'Set'} Target
                                </div>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
