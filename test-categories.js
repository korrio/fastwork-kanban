import { FastworkAPI, JOB_CATEGORIES } from './src/api/fastwork.js';

async function testCategories() {
    const api = new FastworkAPI();
    
    console.log('🔍 Testing Fastwork API with different categories...\n');
    
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
                    console.log(`     ${index + 1}. ${job.title} - ${budget} THB`);
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
    
    console.log('🎯 Testing fetchAllCategories method...');
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
        } else {
            console.log('❌ Failed to fetch jobs from all categories');
        }
    } catch (error) {
        console.log(`❌ Error testing fetchAllCategories: ${error.message}`);
    }
    
    console.log('\n✅ Category testing completed!');
}

testCategories().catch(console.error);