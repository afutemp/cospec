# Managed File Safety

Generated Markdown is whole-file managed. A file is deletable only when all three facts agree:

1. path exists in `.product-kb-meta.json.managedFiles`;
2. path exists in `.source/managed-manifest.json`;
3. file contains a valid `product-kb-managed` marker with matching source IDs.

Non-managed files are never replaced or deleted. Update and Optimize apply from staging after baseline fingerprint validation, create an operation-scoped backup, and use same-directory temporary files before rename.
