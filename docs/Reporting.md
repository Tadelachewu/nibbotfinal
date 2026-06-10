# Nibbot Reporting Console Documentation

This document provides a comprehensive overview of the **Reporting Console** functionality, key terminology, and test cases to ensure accurate data analysis.

---

## **1. General Concepts**

The Reporting Console is designed for high-level performance monitoring and deep operational analysis. It aggregates data from interaction logs and support submissions to provide actionable insights.

### **Core Terms**
- **Interaction**: Any event where a user interacts with the bot (e.g., clicking a menu, sending a message).
- **Unique User**: A distinct session ID or User ID that has interacted with the system within the selected time range.
- **Submission**: A completed report or KYC form submitted via an **Internal Support Menu**.
- **Success Rate**: The percentage of interactions that completed without a system error or failure.
- **Latency (ms)**: The time taken by the server to process a request, specifically for **API Menus**.
- **Conversion Rate**: The percentage of users who opened an **Internal Support Menu** and successfully completed a submission.

---

## **2. Functionality Overview**

### **2.1 General Report (Summary View)**
The **General Report** provides an executive-level summary of system health.

- **Total Metrics**: Quick-glance cards for Interactions, Unique Users, Submissions, and Success Rate.
- **Traffic Dynamics**: An area chart visualizing the volume of total activity vs. successful conversions (submissions) over the selected period.

### **2.2 Detail Report (Hierarchical View)**
The **Detail Report** allows for granular analysis of specific menu nodes.

#### **Categorized Menus**
Activity is automatically grouped into three professional categories:
1. **Static Menu**: Tracks purely informational interactions (FAQs, instructions).
2. **API Menu**: Tracks live integrations. Displays **Average Latency** to monitor third-party service health.
3. **Internal Support Menu**: Tracks operational workflow.
   - **Category Level**: Displays the total sum of Pending, Reviewed, and Resolved cases for all support menus.
   - **Menu Level**: Displays specific status counts (PND, REV, RES) for each individual support node.

### **2.3 Date Filtering**
Users can toggle data views between:
- **Today**: Data from 00:00 to the current time.
- **Week**: Data from the start of the current week.
- **Month**: Data from the start of the current month.
- **Custom**: A flexible date picker for historical analysis.

### **2.4 Data Export**
Professional data extraction in two formats:
- **Spreadsheet (CSV)**: A hierarchical file containing Category totals followed by granular Menu details.
- **Raw Data (JSON)**: Full data dump for developer use or external system integration.

---

## **3. Test Cases**

Use these test cases to verify the integrity of the reporting data.

### **Test Case 1: Interaction Counting**
- **Action**: Open the chat and click a **Static Menu** (e.g., "About Us").
- **Expected Result**: 
  - **General Report**: "Interactions" count increases by 1.
  - **Detail Report**: Under "Static Menu", the specific menu node's "Volume" increases by 1.

### **Test Case 2: Support Lifecycle Tracking**
- **Action**: Submit a new report via an **Internal Support Menu**.
- **Expected Result**: 
  - **General Report**: "Submissions" count increases by 1.
  - **Detail Report**: Under "Internal Support Menu", the category-level "Pending" count increases by 1, and the specific menu's "PND" badge increases by 1.
- **Follow-up**: Update the report status to "Resolved" in the Support Tab.
- **Expected Result**: 
  - **Detail Report**: "Pending" count decreases and "Resolved" count increases.

### **Test Case 3: API Performance Monitoring**
- **Action**: Trigger an **API Menu** that connects to a slow external service.
- **Expected Result**: 
  - **Detail Report**: The "Avg Response" column for that menu reflects the measured latency in milliseconds.

### **Test Case 4: Unique User Aggregation**
- **Action**: Perform 5 different interactions within the same chat session.
- **Expected Result**: 
  - **General Report**: "Interactions" increases by 5, but "Unique Users" increases by only 1.

### **Test Case 5: Export Consistency**
- **Action**: Click "Export Data" -> "Download as CSV".
- **Expected Result**: The downloaded file must contain a "Category" row for **Internal Support Menu** showing the sum of all its children's pending/resolved counts.

---

## **4. Technical Implementation Notes**

- **Matching Logic**: The system uses case-insensitive, normalized matching for menu names to ensure logs and database records align perfectly.
- **Security**: Data fetching is role-aware. Non-admin users are restricted to data they have permission to view.
- **Performance**: Large datasets (up to 500 records per fetch) are optimized using synchronized time windows to ensure charts and tables remain in sync.
