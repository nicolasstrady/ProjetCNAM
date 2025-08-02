package sample;

import client.ServerListener;
import java.io.IOException;
import java.io.InputStream;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.layout.FlowPane;
import javafx.scene.Cursor;
import javafx.scene.effect.ColorAdjust;
import java.util.HashMap;
import java.util.Map;

import java.util.ArrayList;
import java.util.List;

public class PartieController {

    @FXML
    private FlowPane main;
    @FXML
    private Button take;
    @FXML
    private Button refuse;
    @FXML
    private Button retrieveDog;
    @FXML
    private HBox boxRois;
    @FXML
    private HBox boxChien;
    @FXML
    private HBox boxTour;
    @FXML
    private Label tourLabel;
    @FXML
    private ImageView carteCenter;
    @FXML
    private ImageView dog;
    @FXML
    private Label statusLabel;
    @FXML
    private Label labelLeft;
    @FXML
    private Label labelTopLeft;
    @FXML
    private Label labelTopRight;
    @FXML
    private Label labelRight;
    @FXML
    private Label scoreLeft;
    @FXML
    private Label scoreTopLeft;
    @FXML
    private Label scoreTopRight;
    @FXML
    private Label scoreRight;
    @FXML
    private Label scoreSelf;

    private ServerListener listener;
    private int tourCount = 0;
    private boolean sendingTurn = false;
    private final Map<String, String> cardColors = new HashMap<>();
    private final Map<String, Integer> cardRanks = new HashMap<>();
    private int highestAtoutCenter = 0;
    private List<Label> opponentLabels;
    private List<String> playerNames;
    private List<Label> opponentScoreLabels;
    private List<String> pendingDogIds = new ArrayList<>();
    private List<String> pendingDogLiens = new ArrayList<>();
    private List<String> pendingDogColors = new ArrayList<>();

    public void initHand(ArrayList<String> ids, ArrayList<String> liens, ArrayList<String> colors) {
        main.setHgap(-10);
        main.setVgap(0);
        for (int i = 0; i < ids.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + liens.get(i));
            Image img = is != null ? new Image(is,60,100,false,false)
                                   : new Image(getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            ImageView imageCarte = new ImageView(img);
            imageCarte.setId(ids.get(i));
            cardColors.put(ids.get(i), colors.get(i));
            cardRanks.put(ids.get(i), extractRank(liens.get(i)));
            main.getChildren().add(imageCarte);
        }
    }

    private int extractRank(String lien) {
        try {
            String file = lien.substring(lien.lastIndexOf('/') + 1);
            String value = file.substring(5, file.indexOf('_', 5));
            return Integer.parseInt(value);
        } catch (Exception e) {
            return 0;
        }
    }

    public void setPlayerNames(ArrayList<String> names) {
        this.playerNames = names;
        opponentLabels = List.of(labelLeft, labelTopLeft, labelTopRight, labelRight);
        opponentScoreLabels = List.of(scoreLeft, scoreTopLeft, scoreTopRight, scoreRight);
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        for (int i = 1; i <= 4; i++) {
            int playerNum = ((myNum + i - 1) % 5) + 1;
            opponentLabels.get(i - 1).setText(names.get(playerNum - 1));
        }
    }

    public void startListener() {
        try {
            listener = new ServerListener(ConnexionController.host, ConnexionController.port, data -> {
                if (data.isEmpty()) return;
                String type = data.get(0).toString();
                switch (type) {
                    case "ANSWER_UPDATE":
                        handleAnswerUpdate(data.subList(1, data.size()));
                        break;
                    case "CALL_INFO":
                        handleCallInfo(data.subList(1, data.size()));
                        break;
                    case "DOG_READY":
                        startNextTurn();
                        break;
                    case "TOUR_UPDATE":
                        handleTourUpdate(data.subList(1, data.size()));
                        break;
                    default:
                        break;
                }
            });
            Thread t = new Thread(listener);
            t.setDaemon(true);
            t.start();

            ArrayList<Object> wait = new ArrayList<>();
            wait.add("WAITANSWER");
            try {
                ArrayList<Object> resp = ConnexionController.client.send(wait);
                handleAnswerUpdate(resp);
            } catch (IOException | ClassNotFoundException ex) {
                ex.printStackTrace();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void handleAnswerUpdate(List<Object> resp) {
        int current = (int) resp.get(0);
        String takeFlag = (String) resp.get(1);
        int numPlayerTake = (int) resp.get(2);
        if (takeFlag.equals("TAKE")) {
            statusLabel.setText("Joueur " + numPlayerTake + " a pris le chien");
            take(numPlayerTake);
        } else if (current == Integer.parseInt(AccueilController.numJoueur)) {
            statusLabel.setText("A votre tour !");
            take.setVisible(true);
            refuse.setVisible(true);
        } else {
            statusLabel.setText("Au tour du Joueur " + current);
        }
    }

    private void handleCallInfo(List<Object> resp) {
        statusLabel.setText("Le Roi de " + resp.get(4) + " a été appelé !");
        boxChien.getChildren().clear();
        ArrayList<Integer> idCartes = (ArrayList<Integer>) resp.get(1);
        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(2);
        for (int i = 0; i < idCartes.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            ImageView imageChien = new ImageView(img);
            boxChien.getChildren().add(imageChien);
        }
        carteCenter.setVisible(false);
        if (!pendingDogIds.isEmpty()) {
            retrieveDog.setVisible(true);
        }
    }

    private void handleTourUpdate(List<Object> resp) {
        int current = (int) resp.get(0);
        boolean finTour = (boolean) resp.get(1);
        boolean finPartie = (boolean) resp.get(2);
        ArrayList<String> idCartes = (ArrayList<String>) resp.get(3);
        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(4);
        String couleur = resp.size() > 5 ? (String) resp.get(5) : "";
        ArrayList<Double> scores = resp.size() > 6 ? (ArrayList<Double>) resp.get(6) : null;
        boxTour.getChildren().clear();
        highestAtoutCenter = 0;
        for (int i = 0; i < idCartes.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            boxTour.getChildren().add(new ImageView(img));
            if (lienCartes.get(i).contains("Atout")) {
                int r = extractRank(lienCartes.get(i));
                if (r > highestAtoutCenter) {
                    highestAtoutCenter = r;
                }
            }
        }
        updateCurrentPlayerLabel(current);
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        if (scores != null && playerNames != null && scores.size() == playerNames.size()) {
            scoreSelf.setText(String.format("%.1f", scores.get(myNum - 1)));
            for (int i = 1; i <= 4; i++) {
                int playerNum = ((myNum + i - 1) % 5) + 1;
                opponentScoreLabels.get(i - 1).setText(String.format("%.1f", scores.get(playerNum - 1)));
            }
        }
        if (current == myNum && !finTour && !finPartie) {
            statusLabel.setText("A votre tour !");
            tourLabel.setText("Tour " + tourCount + " : A votre tour");
        } else if (finTour && !finPartie) {
            statusLabel.setText("Le tour est fini !");
            tourLabel.setText("Tour " + tourCount + " terminé");
            startNextTurn();
        } else if (finPartie) {
            statusLabel.setText("La partie est finie !");
            tourLabel.setText("Fin de partie");
        } else {
            statusLabel.setText("Au tour du Joueur " + current);
            tourLabel.setText("Tour " + tourCount + " : Au tour du Joueur " + current);
        }
        updatePlayableCards(current, couleur);
    }

    private void updatePlayableCards(int current, String couleur) {
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        boolean isMyTurn = current == myNum;
        boolean hasColor = false;
        boolean hasAtout = false;
        boolean hasHigherAtout = false;
        if (isMyTurn && !couleur.isEmpty()) {
            for (int i = 0; i < main.getChildren().size(); i++) {
                ImageView img = (ImageView) main.getChildren().get(i);
                String id = img.getId();
                String color = cardColors.get(id);
                if (couleur.equals(color)) {
                    hasColor = true;
                }
                if ("ATOUT".equals(color) || "BOUT".equals(color)) {
                    hasAtout = true;
                    int r = cardRanks.getOrDefault(id, 0);
                    if (r > highestAtoutCenter) {
                        hasHigherAtout = true;
                    }
                }
            }
        }
        ColorAdjust gray = new ColorAdjust();
        gray.setSaturation(-1);
        gray.setBrightness(-0.3);
        for (int i = 0; i < main.getChildren().size(); i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setOnMouseClicked(null);
            imageCarte.setOnMouseEntered(null);
            imageCarte.setOnMouseExited(null);
            imageCarte.setScaleX(1);
            imageCarte.setScaleY(1);
            imageCarte.setViewOrder(0);
            if (!isMyTurn) {
                imageCarte.setDisable(true);
                imageCarte.setEffect(gray);
                continue;
            }
            boolean disable = false;
            String id = imageCarte.getId();
            String color = cardColors.get(id);
            int rank = cardRanks.getOrDefault(id, 0);
            if (!couleur.isEmpty()) {
                if (hasColor) {
                    if (!couleur.equals(color)) {
                        disable = true;
                    }
                } else if (hasAtout) {
                    if (!("ATOUT".equals(color) || "BOUT".equals(color))) {
                        disable = true;
                    } else if (highestAtoutCenter > 0 && hasHigherAtout && rank < highestAtoutCenter) {
                        disable = true;
                    }
                }
            }
            imageCarte.setDisable(disable);
            if (disable) {
                imageCarte.setEffect(gray);
                imageCarte.setCursor(Cursor.DEFAULT);
                continue;
            } else {
                imageCarte.setEffect(null);
            }
            int finalI = i;
            imageCarte.setOnMouseEntered(e -> {
                imageCarte.setScaleX(1.2);
                imageCarte.setScaleY(1.2);
                imageCarte.setViewOrder(-1);
                imageCarte.setCursor(Cursor.HAND);
            });
            imageCarte.setOnMouseExited(e -> {
                imageCarte.setScaleX(1);
                imageCarte.setScaleY(1);
                imageCarte.setViewOrder(0);
                imageCarte.setCursor(Cursor.DEFAULT);
            });
            imageCarte.setOnMouseClicked(e -> {
                ArrayList<Object> playTours = new ArrayList<>();
                playTours.add("PLAYTOUR");
                playTours.add(imageCarte.getId());
                playTours.add(ConnexionController.idUser);
                playTours.add(finalI + 1);
                ArrayList<Object> datas = null;
                try {
                    datas = ConnexionController.client.send(playTours);
                } catch (IOException | ClassNotFoundException ex) {
                    ex.printStackTrace();
                    return;
                }
                boolean hasError = (boolean) datas.get(0);
                if (!hasError) {
                    main.getChildren().remove(imageCarte);
                    disableAllCards();
                } else {
                    statusLabel.setText("Carte non valide !");
                }
            });
        }
    }

    private void disableAllCards() {
        ColorAdjust gray = new ColorAdjust();
        gray.setSaturation(-1);
        gray.setBrightness(-0.3);
        for (int i = 0; i < main.getChildren().size(); i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setDisable(true);
            imageCarte.setEffect(gray);
            imageCarte.setCursor(Cursor.DEFAULT);
        }
    }

    private void updateCurrentPlayerLabel(int current) {
        if (opponentLabels == null || playerNames == null) return;
        for (Label l : opponentLabels) {
            l.setStyle("");
        }
        int myNum = Integer.parseInt(AccueilController.numJoueur);
        int diff = (current - myNum + 5) % 5;
        if (diff >= 1 && diff <= 4) {
            opponentLabels.get(diff - 1).setStyle("-fx-font-weight: bold;");
        }
    }

    public void playWithDog() throws InterruptedException {
        ArrayList<Object> chiens = new ArrayList<>();
        chiens.add("CHIEN");
        chiens.add(ConnexionController.idUser);

        try {
            ConnexionController.client.send(chiens);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        refuse.setVisible(false);
        take.setVisible(false);
    }

    public void playWithoutDog() throws InterruptedException {
        ArrayList<Object> refuses = new ArrayList<>();
        refuses.add("REFUSE");
        refuses.add(ConnexionController.idUser);

        try {
            ConnexionController.client.send(refuses);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        refuse.setVisible(false);
        take.setVisible(false);
    }

    public void take(int numPlayerTake) {
        if(numPlayerTake == Integer.parseInt(AccueilController.numJoueur)){
            carteCenter.setVisible(false);
            ArrayList<Object> rois = new ArrayList<>();
            rois.add("ROIS");
            rois.add(ConnexionController.idUser);
            ArrayList<Object> datas = null;
            try {
                datas = ConnexionController.client.send(rois);
            } catch (IOException | ClassNotFoundException e) {
                e.printStackTrace();
            }
            ArrayList<String> idCartes = (ArrayList<String>) datas.get(0);
            ArrayList<String> lienCartes = (ArrayList<String>) datas.get(1);
            boxRois.setSpacing(20);
            for(int i = 0; i < idCartes.size() ; i++) {
                    InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
                    Image img = is != null ? new Image(is,60,100,false,false)
                                         : new Image(getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
                    ImageView imageRoi = new ImageView(img);
                    int finalI = i;
                    imageRoi.addEventHandler(javafx.scene.input.MouseEvent.MOUSE_CLICKED, event -> {
                        callKing(idCartes.get(finalI));
                    });
                    boxRois.getChildren().add(imageRoi);
            }
        } else {
            ArrayList<Object> waitcalls = new ArrayList<>();
            waitcalls.add("WAITCALL");
            waitcalls.add(ConnexionController.idUser);
            try {
                ArrayList<Object> resp = ConnexionController.client.send(waitcalls);
                if ((boolean) resp.get(0)) {
                    handleCallInfo(resp);
                }
            } catch (IOException | ClassNotFoundException e) {
                e.printStackTrace();
            }
        }
    }
    public void callKing(String idCarte) {
        boxRois.getChildren().clear();
        boxRois.setSpacing(20);
        boxChien.setSpacing(20);
        ArrayList<Object> calls = new ArrayList<>();
        calls.add("CALL");
        calls.add(Integer.parseInt(idCarte));
        calls.add(ConnexionController.idUser);
        ArrayList<Object> datas2 = null;
        try {
            datas2 = ConnexionController.client.send(calls);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
            return;
        }
        ArrayList<Integer> idsTmp = (ArrayList<Integer>) datas2.get(0);
        pendingDogIds = new ArrayList<>();
        for (Integer i : idsTmp) {
            pendingDogIds.add(i.toString());
        }
        pendingDogLiens = (ArrayList<String>) datas2.get(1);
        pendingDogColors = (ArrayList<String>) datas2.get(2);
    }

    @FXML
    public void retrieveDogCards() {
        for (int j = 0; j < pendingDogIds.size(); j++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + pendingDogLiens.get(j));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            ImageView handView = new ImageView(img);
            handView.setId(pendingDogIds.get(j));
            cardColors.put(pendingDogIds.get(j), pendingDogColors.get(j));
            main.getChildren().add(handView);
        }
        boxChien.getChildren().clear();
        retrieveDog.setVisible(false);
        enableDogSelection();
    }

    private void enableDogSelection() {
        for (int i = 0; i < main.getChildren().size(); i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> addDogs = new ArrayList<>();
                addDogs.add("ADDDOG");
                addDogs.add(imageCarte.getId());
                ArrayList<Object> datas3 = null;
                try {
                    datas3 = ConnexionController.client.send(addDogs);
                } catch (IOException | ClassNotFoundException ex) {
                    ex.printStackTrace();
                }
                boolean dogDone = (boolean) datas3.get(0);
                String ok = (String) datas3.get(1);

                if(ok.equals("OK")) {
                    main.getChildren().remove(imageCarte);
                    ImageView dogCard = new ImageView(imageCarte.getImage());
                    dogCard.setFitWidth(60);
                    dogCard.setFitHeight(100);
                    boxChien.getChildren().add(dogCard);
                    if(dogDone) {
                        for (int j = 0; j < main.getChildren().size(); j++) {
                            ImageView imageCarte1 = (ImageView) main.getChildren().get(j);
                            imageCarte1.setDisable(true);
                        }
                    }
                }
                else {
                    statusLabel.setText("Mauvaise carte dans le chien !");
                }

            });
        }
    }


    private void requestCurrentTour() {
        ArrayList<Object> waitTours = new ArrayList<>();
        waitTours.add("WAITTOUR");
        try {
            ArrayList<Object> resp = ConnexionController.client.send(waitTours);
            handleTourUpdate(resp);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
    }

    private void startNextTurn() {
        if (sendingTurn) return;
        sendingTurn = true;
        boxChien.getChildren().clear();
        boxTour.getChildren().clear();
        tourCount++;
        ArrayList<Object> begins = new ArrayList<>();
        begins.add("BEGIN");
        try {
            ConnexionController.client.send(begins);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        requestCurrentTour();
        sendingTurn = false;
    }


}
