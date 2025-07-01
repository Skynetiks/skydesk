# Client List Table Update

## Overview
The client list has been converted from a card-based layout to a table layout with infinite query functionality for better performance and user experience.

## Changes Made

### 1. Backend Changes (Client Router)
- **File**: `src/server/routers/client.ts`
- **Change**: Updated the `getAll` procedure to support cursor-based pagination instead of offset-based pagination
- **Benefits**: 
  - Better performance for large datasets
  - Consistent data when new items are added
  - No duplicate or missing items during pagination

### 2. Frontend Changes (ClientList Component)
- **File**: `src/components/ClientList.tsx`
- **Changes**:
  - Replaced card grid layout with table layout
  - Implemented infinite query using `useInfiniteQuery`
  - Added debounced search functionality (300ms delay)
  - Added "Load More" button for pagination
  - Improved loading states and empty states
  - Added multi-select functionality with checkboxes
  - Added bulk delete with progress feedback
  - Replaced confirm dialogs with modern dialog boxes

### 3. Page Structure Updates
- **File**: `src/app/clients/page.tsx`
- **Changes**:
  - Added proper skeleton loading states using PageSkeleton
  - Created ClientListSkeleton component for table loading
  - Added ticket stats to SideNav for consistency
  - Improved loading UX with proper skeleton structure

### 4. UI Components
- **Added**: Table components from shadcn/ui
- **File**: `src/components/ui/table.tsx`
- **Added**: Dialog components from shadcn/ui
- **File**: `src/components/ui/dialog.tsx`
- **Added**: Checkbox components from shadcn/ui
- **File**: `src/components/ui/checkbox.tsx`
- **Added**: Toast notifications with Sonner
- **File**: `src/components/ui/sonner.tsx`
- **Added**: Skeleton components for loading states
- **File**: `src/components/ClientListSkeleton.tsx`

## Features

### Table Layout
- **Columns**: Select (admin), Name, Company, Emails, Phone, Location, Actions
- **Responsive**: Works on all screen sizes
- **Hover effects**: Row highlighting on hover
- **Compact**: More data visible at once
- **Multi-select**: Checkboxes for bulk operations (admin only)

### Infinite Query
- **Initial load**: 20 clients per page
- **Load more**: Click "Load More" button to fetch next batch
- **Search**: Debounced search across name, company, and emails
- **Performance**: Only loads data when needed

### Search Functionality
- **Debounced**: 300ms delay to prevent excessive API calls
- **Real-time**: Results update as you type
- **Multi-field**: Searches name, company name, and emails

### Multi-Select Functionality
- **Individual Selection**: Checkbox for each client row
- **Select All**: Header checkbox to select/deselect all visible clients
- **Indeterminate State**: Header checkbox shows partial selection state
- **Bulk Actions**: Delete multiple selected clients at once
- **Selection Counter**: Shows number of selected clients
- **Admin Only**: Multi-select features only available to admin users
- **Progress Feedback**: Real-time progress bar and status updates during deletion
- **Visual Feedback**: Selected clients are highlighted during deletion process
- **Toast Notifications**: Success/error messages after bulk operations
- **Confirmation Dialogs**: Modern dialog boxes instead of browser confirm dialogs

### Actions
- **View**: Eye icon to view client details
- **Edit**: Pencil icon to edit client (admin only)
- **Delete**: Trash icon to delete client (admin only) - with confirmation dialog
- **Multi-select**: Checkboxes for selecting multiple clients (admin only)
- **Bulk Delete**: Delete multiple selected clients at once (admin only) - with confirmation dialog

## Technical Implementation

### Infinite Query Setup
```typescript
const {
  data,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  refetch,
} = trpc.client.getAll.useInfiniteQuery(
  {
    limit: 20,
    search: debouncedSearch || undefined,
  },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

### Debounced Search
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 300);

  return () => clearTimeout(timer);
}, [search]);
```

### Data Flattening
```typescript
const allClients = data?.pages.flatMap((page) => page.items) ?? [];
```

### Multi-Select State Management
```typescript
const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
const [isDeleting, setIsDeleting] = useState(false);
const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    setSelectedClients(new Set(allClients.map(client => client.id)));
  } else {
    setSelectedClients(new Set());
  }
};

const handleSelectClient = (clientId: string, checked: boolean) => {
  const newSelected = new Set(selectedClients);
  if (checked) {
    newSelected.add(clientId);
  } else {
    newSelected.delete(clientId);
  }
  setSelectedClients(newSelected);
};

const isAllSelected = allClients.length > 0 && selectedClients.size === allClients.length;
const isIndeterminate = selectedClients.size > 0 && selectedClients.size < allClients.length;
```

### Dialog State Management
```typescript
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
const [clientToDelete, setClientToDelete] = useState<string | null>(null);
```

### Individual Delete with Dialog
```typescript
const handleDelete = async (id: string) => {
  setClientToDelete(id);
  setShowDeleteDialog(true);
};

const confirmDelete = async () => {
  if (!clientToDelete) return;
  
  try {
    await deleteMutation.mutateAsync({ id: clientToDelete });
    toast.success("Client deleted successfully");
  } catch (error) {
    console.error("Failed to delete client:", error);
    toast.error("Failed to delete client. Please try again.");
  } finally {
    setShowDeleteDialog(false);
    setClientToDelete(null);
  }
};
```

### Bulk Delete Implementation with Progress Feedback
```typescript
const handleBulkDelete = async () => {
  if (selectedClients.size === 0) return;
  setShowBulkDeleteDialog(true);
};

const confirmBulkDelete = async () => {
  setIsDeleting(true);
  setDeleteProgress({ current: 0, total: selectedClients.size });
  
  const toastId = toast.loading(
    `Deleting ${selectedClients.size} client${selectedClients.size > 1 ? 's' : ''}...`
  );
  
  try {
    const clientIds = Array.from(selectedClients);
    
    // Delete clients one by one with progress tracking
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      await deleteMutation.mutateAsync({ id: clientId });
      setDeleteProgress({ current: i + 1, total: clientIds.length });
    }
    
    setSelectedClients(new Set()); // Clear selection
    toast.success(
      `Successfully deleted ${clientIds.length} client${clientIds.length > 1 ? 's' : ''}`,
      { id: toastId }
    );
  } catch (error) {
    console.error("Failed to delete clients:", error);
    toast.error("Failed to delete some clients. Please try again.", { id: toastId });
  } finally {
    setIsDeleting(false);
    setDeleteProgress({ current: 0, total: 0 });
    setShowBulkDeleteDialog(false);
  }
};
```

## Benefits

1. **Performance**: Better handling of large datasets
2. **UX**: More data visible, easier scanning
3. **Scalability**: Cursor-based pagination handles growth better
4. **Search**: Debounced search prevents API spam
5. **Responsive**: Table works well on all devices
6. **Bulk Operations**: Efficient multi-select and bulk delete functionality

## Migration Notes

- No breaking changes to existing functionality
- All CRUD operations remain the same
- Search functionality improved with debouncing
- Pagination changed from page-based to cursor-based 