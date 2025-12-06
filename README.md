# exec-all

> Run multiple programs, see complete results, when first available.

# Why

Sometimes I run search tasks on my compute. I want these to be parallel, but I dont want the input to intermix.

# Usage

```bash
exec-all \
  "sh -c 'sleep 2 && echo have a nice day'" \
  "echo hello" \
  "sh -c 'sleep 1 && echo world'"
```

Runs commands in parallel, printing each command's output as soon as it completes.

## Options

- `-q, --quiet`: Don't show separator messages between command outputs
- `-h, --help`: Show help
- `-v, --version`: Show version
