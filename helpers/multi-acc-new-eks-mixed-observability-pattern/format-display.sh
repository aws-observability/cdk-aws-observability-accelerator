log() {
    echo
    if [[ $# -ne 2 ]]; then
        echo -e "\033[0;33m$@\033[0m" # Yellow text
    else
        case $1 in
            G)
                echo -e "\033[0;32m${2}\033[0m" # Green text
                ;;
            O)
                echo -e "\033[0;33m${2}\033[0m" # Orange text
                ;;
            Y)
                echo -e "\033[1;33m${2}\033[0m" # Yellow text
                ;;
            R)
                echo -e "\033[0;31m${2}\033[0m" # Red text
                ;;
            W)
                echo -e "\033[1;37m${2}\033[0m" # White text
                ;;
            C)
                echo -e "\033[0;36m${2}\033[0m" # Cyan text
                ;;
            B)
                echo -e "\033[0;34m${2}\033[0m" # Blue text
                ;;
            P)
                echo -e "\033[0;35m${2}\033[0m" # Purple text
                ;;
            G-H)
                echo -e "\e[37;42m${2}\e[0m" # Green highlighted text
                ;;
            *)
                echo -e "\033[0;33m${2}\033[0m" # Orange text
                ;;
        esac
    fi

}
