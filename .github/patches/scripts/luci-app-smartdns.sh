#!/bin/bash

# Define the relative path to the target Makefile
TARGET_FILE="luci-app-smartdns/Makefile"

echo "=================================================================="
echo "  Initiating robust smartdns_ui default configuration update"
echo "=================================================================="

# Verify the existence of the target file
if [ -f "$TARGET_FILE" ]; then
    echo "=> SUCCESS: Target file located ($TARGET_FILE)."
    
    # Check if the smartdns_ui configuration identifier exists anywhere in the file
    if grep -q "INCLUDE_smartdns_ui" "$TARGET_FILE"; then
        
        # Isolate the relevant config block (from the identifier to 'endef') and check for 'default y'
        if awk '/INCLUDE_smartdns_ui/,/endef/' "$TARGET_FILE" | grep -q "default y"; then
            echo "=> INFO: smartdns_ui is already enabled ('default y'). No modifications required."
        else
            # Perform robust inline text substitution:
            # 1. Target the specific block between 'INCLUDE_smartdns_ui' and 'endef'
            # 2. Match 'default n' or 'default N', ignoring any leading/trailing tabs or spaces
            # 3. Replace it with a properly tab-indented 'default y'
            sed -i '/INCLUDE_smartdns_ui/,/endef/ s/^[[:space:]]*default[[:space:]]*[nN].*/\tdefault y/' "$TARGET_FILE"
            
            echo "=> DONE: Successfully updated the default option for smartdns_ui to 'y'."
            
            # Git operations: Stage and commit the modified file
            echo "=> INFO: Staging and committing changes to Git..."
            git add "$TARGET_FILE"
            
            # Attempt to commit and provide feedback based on the exit status
            if git commit -m "chore: enable smartdns_ui by default"; then
                echo "=> SUCCESS: Changes successfully committed to the repository."
            else
                echo "=> WARNING: Git commit failed. Ensure this directory is a valid Git repository and your Git environment is configured."
            fi
        fi
    else
        echo "=> WARNING: Could not locate the 'INCLUDE_smartdns_ui' configuration block."
        echo "=> ACTION REQUIRED: The Makefile structure may have changed significantly. Manual inspection is advised."
        exit 1
    fi
else
    echo "=> ERROR: Target file not found ($TARGET_FILE)."
    echo "=> ACTION REQUIRED: Please ensure this script is executed in a directory containing the 'luci-app-smartdns' repository."
    exit 1
fi

echo "=================================================================="
