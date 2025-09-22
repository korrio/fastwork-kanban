import { FastworkAPI, JOB_CATEGORIES } from './src/api/fastwork.js';

async function test4Categories() {
    const api = new FastworkAPI();
    
    console.log('🔍 Testing Fastwork API with all 4 job categories...\n');
    
    for (const [key, category] of Object.entries(JOB_CATEGORIES)) {
        console.log(`📂 Testing ${category.nameEn} (${category.name})`);
        console.log(`   Category ID: ${category.id}`);
        
        try {
            const result = await api.fetchJobs({ 
                tagIds: [category.id], 
                pageSize: 3 
            });
            
            if (result.success && result.jobs.length > 0) {
                console.log(`   ✅ Found ${result.jobs.length} jobs`);
                
                result.jobs.forEach((job, index) => {
                    const budget = job.budget || 'N/A';
                    const title = job.title.length > 50 ? job.title.substring(0, 47) + '...' : job.title;
                    console.log(`     ${index + 1}. ${title} - ${budget} THB`);
                });
            } else {
                console.log(`   ❌ No jobs found or API error`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for spacing
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('🎯 Testing fetchAllCategories method with 4 sources...');
    try {
        const allResult = await api.fetchAllCategories({ pageSize: 2 });
        
        if (allResult.success) {
            console.log(`✅ Successfully fetched jobs from ${allResult.categoriesCount} categories`);
            console.log(`📊 Total jobs found: ${allResult.jobs.length}`);
            
            // Group by category
            const byCategory = {};
            allResult.jobs.forEach(job => {
                if (!byCategory[job.category]) {
                    byCategory[job.category] = [];
                }
                byCategory[job.category].push(job);
            });
            
            Object.entries(byCategory).forEach(([category, jobs]) => {
                console.log(`   ${category}: ${jobs.length} jobs`);
            });

            // Check for jobs with budget >= 10,000 THB
            const highBudgetJobs = allResult.jobs.filter(job => job.budget >= 10000);
            console.log(`💰 High budget jobs (≥10,000 THB): ${highBudgetJobs.length}`);
            
            highBudgetJobs.forEach(job => {
                console.log(`   • ${job.title} - ${job.budget.toLocaleString()} THB (${job.category})`);
            });
            
        } else {
            console.log('❌ Failed to fetch jobs from all categories');
        }
    } catch (error) {
        console.log(`❌ Error testing fetchAllCategories: ${error.message}`);
    }
    
    console.log('\n✅ 4-category testing completed!');
    console.log('🚀 Ready to use in Kanban board with all 4 sources');
}

test4Categories().catch(console.error);