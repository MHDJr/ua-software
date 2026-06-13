export interface VelocityMetrics {
    averageReadLagMinutes: number; // created_at -> read_at
    averageExecutionHours: number; // read_at -> final completion
    averageTotalHours: number; // created_at -> final completion
    velocityScore: number; // speed score out of 100
    completedCount: number;
}

export function computeVelocityMetrics(tasks: any[], completedTasks: any[]): VelocityMetrics {
    let totalReadLag = 0;
    let readLagCount = 0;
    
    let totalExecutionTime = 0;
    let executionCount = 0;
    
    let totalTime = 0;
    let totalCount = 0;
    
    const allTasks = [...(tasks || []), ...(completedTasks || [])];
    
    allTasks.forEach(task => {
        if (!task) return;
        
        const created = task.created_at ? new Date(task.created_at).getTime() : null;
        const read = task.read_at ? new Date(task.read_at).getTime() : null;
        
        // Evaluate if task is completed or under review
        const statusStr = (task.status || "").toLowerCase();
        const isCompleted = statusStr === 'completed' || statusStr === 'reviewed' || statusStr === 'under_review' || statusStr === 'in_review';
        const completed = (isCompleted && task.updated_at) ? new Date(task.updated_at).getTime() : null;
        
        if (created && read) {
            totalReadLag += Math.max(0, read - created);
            readLagCount++;
        }
        
        if (read && completed) {
            totalExecutionTime += Math.max(0, completed - read);
            executionCount++;
        }
        
        if (created && completed) {
            totalTime += Math.max(0, completed - created);
            totalCount++;
        }
    });
    
    const averageReadLagMinutes = readLagCount > 0 ? (totalReadLag / readLagCount) / (1000 * 60) : 0;
    const averageExecutionHours = executionCount > 0 ? (totalExecutionTime / executionCount) / (1000 * 60 * 60) : 0;
    const averageTotalHours = totalCount > 0 ? (totalTime / totalCount) / (1000 * 60 * 60) : 0;
    
    // Scale velocity score out of 100.
    // If average total hours is low (e.g. under 12 hours), the velocity score is high.
    let velocityScore = 84; // Default fallback baseline
    if (totalCount > 0) {
        // Linear scale where average 48 hours results in score of ~50, and <12 hours results in ~90+
        velocityScore = Math.max(30, Math.min(100, Math.round(100 - (averageTotalHours * 1.2))));
    }
    
    return {
        averageReadLagMinutes: Math.round(averageReadLagMinutes * 10) / 10,
        averageExecutionHours: Math.round(averageExecutionHours * 10) / 10,
        averageTotalHours: Math.round(averageTotalHours * 10) / 10,
        velocityScore: isNaN(velocityScore) ? 84 : velocityScore,
        completedCount: totalCount
    };
}
